import express from "express";
import cors from "cors";
import { YtDlp } from "ytdlp-nodejs";
import { limparTitulo } from "./utils/limpar.js";
import { createReadStream, promises as fs } from "fs";
import path from "path";

const server = express();
server.use(cors({ exposedHeaders: ["Content-Disposition"] }));
server.use(express.json());

const installer = new YtDlp();
let ffmpeg = false;

try {
    await installer.downloadFFmpeg();
    ffmpeg = true;
} catch (e) {
    console.error("Falha ao baixar FFmpeg:", e.message);
}

async function deletarArquivo(caminho) {
    try {
        await fs.unlink(caminho);
    } catch (e) {}
}

async function obterDiretorioTemp() {
    if (process.env.RAILWAY_ENVIRONMENT) {
        const dir = "/data";
        await fs.mkdir(dir, { recursive: true });
        return dir;
    }
    const dir = path.join(process.cwd(), "data", "tmp");
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

server.post("/Install/Video", async (req, res) => {
    let caminhoTemporario = null;
    try {
        const { url } = req.body;
        const infoVideo = await installer.getInfoAsync(url);
        const NewTitle = limparTitulo(infoVideo.title);

        const diretorioTemp = await obterDiretorioTemp();
        caminhoTemporario = path.join(diretorioTemp, `${Date.now()}.mp4`);

        await installer.download(url, {
            output: caminhoTemporario,
            filter: "mergevideo",
            quality: "720p",
            type: "mp4",
            onProgress: (p) => console.log(`Progress: ${p.percentage_str}`)
        });

        res.setHeader("Content-Disposition", `attachment; filename="${NewTitle}.mp4"`);
        res.setHeader("Content-Type", "video/mp4");

        const streamLeitura = createReadStream(caminhoTemporario);
        streamLeitura.pipe(res);

        streamLeitura.on("close", () => {
            deletarArquivo(caminhoTemporario);
        });

    } catch (error) {
        console.error(error);
        if (caminhoTemporario) await deletarArquivo(caminhoTemporario);
        res.status(500).send({ error: error.message });
    }
});

server.post("/Install/Music", async (req, res) => {
    let caminhoTemporario = null;
    try {
        const { url } = req.body;
        const infoAudio = await installer.getInfoAsync(url);
        const NewTitle = limparTitulo(infoAudio.title);

        const diretorioTemp = await obterDiretorioTemp();
        caminhoTemporario = path.join(diretorioTemp, `${Date.now()}.mp3`);

        await installer.download(url, {
            output: caminhoTemporario,
            filter: "audioonly",
            audioQuality: 10,
            type: "mp3",
            onProgress: (p) => console.log(`Progress: ${p.percentage_str}`)
        });

        res.setHeader("Content-Disposition", `attachment; filename="${NewTitle}.mp3"`);
        res.setHeader("Content-Type", "audio/mpeg");

        const streamLeitura = createReadStream(caminhoTemporario);
        streamLeitura.pipe(res);

        streamLeitura.on("close", () => {
            deletarArquivo(caminhoTemporario);
        });

    } catch (error) {
        console.error(error);
        if (caminhoTemporario) await deletarArquivo(caminhoTemporario);
        res.status(500).send({ error: error.message });
    }
});

server.post("/GetPlaylist", async (req, res) => {
    try {
        const { url } = req.body;
        const info = await installer.getInfoAsync(url);

        if (info._type === "playlist") {
            res.send({
                isPlaylist: true,
                title: info.title,
                videos: info.entries.map((entry) => ({
                    title: entry.title,
                    url: entry.url,
                    id: entry.id
                }))
            });
        } else {
            res.send({
                isPlaylist: false,
                video: { title: info.title, url: url, id: info.id }
            });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

server.listen(5010, () => console.log(`BackEnd: Ok \nffmpeg Loaded? ${ffmpeg}`));