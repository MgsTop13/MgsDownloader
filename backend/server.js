import express from "express";
import cors from "cors";
import { YtDlp } from "ytdlp-nodejs";
import { limparTitulo } from "./utils/limpar.js";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const server = express();
server.use(cors({ exposedHeaders: ["Content-Disposition"] }));
server.use(express.json());

const installer = new YtDlp({ cookiesFromBrowser: "firefox" });

let ffmpegOk = false;
try {
    await installer.downloadFFmpeg();
    ffmpegOk = true;
} catch (e) {
    console.error("Falha ao baixar FFmpeg:", e.message);
}

async function limparDir(dir) {
    if (!dir) return;
    try {
        await fs.rm(dir, { recursive: true, force: true });
    } catch {}
}

async function obterDiretorioTemp() {
    const dir = path.join(process.cwd(), "temp");
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function baixarParaDirUnico(url, opcoes) {
    const dirBase = await obterDiretorioTemp();
    const dirJob = path.join(
        dirBase,
        `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
    await fs.mkdir(dirJob, { recursive: true });

    await installer.download(url, {
        ...opcoes,
        output: path.join(dirJob, "%(title)s.%(ext)s"),
    });

    const arquivos = await fs.readdir(dirJob);
    let melhor = null;
    let melhorTamanho = -1;

    for (const nome of arquivos) {
        if (nome.endsWith(".part") || nome.endsWith(".ytdl")) continue;
        const full = path.join(dirJob, nome);
        const st = await fs.stat(full).catch(() => null);
        if (st?.isFile() && st.size > melhorTamanho) {
            melhorTamanho = st.size;
            melhor = full;
        }
    }

    if (!melhor) throw new Error("Nenhum arquivo foi gerado pelo yt-dlp.");
    return { caminho: melhor, dirJob };
}

function enviarArquivo(res, caminho, contentType, nomeSaida, dirParaLimpar) {
    const asciiFallback = nomeSaida.replace(/[^\x20-\x7e]/g, "_");
    const utf8Encoded = encodeURIComponent(nomeSaida);

    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`
    );
    res.setHeader("Content-Type", contentType);

    const stream = createReadStream(caminho);
    stream.on("error", async (err) => {
        console.error("Erro no stream:", err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
        await limparDir(dirParaLimpar);
    });
    stream.on("close", () => limparDir(dirParaLimpar));
    stream.pipe(res);
}

server.post("/Install/Video", async (req, res) => {
    let dirJob = null;
    try {
        const { url } = req.body;
        if (!url) return res.status(400).send({ error: "URL obrigatória." });

        const { caminho, dirJob: dir } = await baixarParaDirUnico(url, {
            formatSort: ["vcodec:h264", "res:720"],
            quality: "720p",
            filter: "videoandaudio",
            onProgress: (p) => console.log(`[Vídeo] ${p.percentage_str ?? ""}`),
        });

        dirJob = dir;

        const nomeSaida = `video_${Date.now()}.mp4`;
        enviarArquivo(res, caminho, "video/mp4", nomeSaida, dirJob);
    } catch (error) {
        console.error("[Vídeo] Erro:", error);
        await limparDir(dirJob);
        if (!res.headersSent) res.status(500).send({ error: error.message });
    }
});

server.post("/Install/Music", async (req, res) => {
    let dirJob = null;
    try {
        const { url } = req.body;
        if (!url) return res.status(400).send({ error: "URL obrigatória." });

        const info = await installer.getInfoAsync(url);
        const titulo = limparTitulo(info.title) || `audio_${Date.now()}`;

        const { caminho, dirJob: dir } = await baixarParaDirUnico(url, {
            filter: "audio",
            audioQuality: "0",
            extractAudio: true,
            audioFormat: "mp3",
            onProgress: (p) => console.log(`[Áudio] ${p.percentage_str ?? ""}`),
        });

        dirJob = dir;

        const nomeSaida = `${titulo}.mp3`;
        enviarArquivo(res, caminho, "audio/mpeg", nomeSaida, dirJob);
    } catch (error) {
        console.error("[Áudio] Erro:", error);
        await limparDir(dirJob);
        if (!res.headersSent) res.status(500).send({ error: error.message });
    }
});

server.post("/GetPlaylist", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).send({ error: "URL obrigatória." });

        const info = await installer.getInfoAsync(url);
        const isPlaylist =
            info._type === "playlist" ||
            (Array.isArray(info.entries) && info.entries.length > 0);

        if (isPlaylist) {
            return res.send({
                isPlaylist: true,
                title: info.title ?? "Playlist",
                videos: info.entries
                    .filter((e) => e?.url)
                    .map((entry) => ({
                        title: entry.title ?? "Sem título",
                        url: entry.url,
                        id: entry.id ?? "",
                    })),
            });
        }

        return res.send({
            isPlaylist: false,
            video: {
                title: info.title ?? "Sem título",
                url,
                id: info.id ?? "",
            },
        });
    } catch (error) {
        console.error("[Playlist] Erro:", error);
        res.status(500).send({ error: error.message });
    }
});

server.listen(5010, () =>
    console.log(`BackEnd: OK\nFFmpeg carregado? ${ffmpegOk}`)
);