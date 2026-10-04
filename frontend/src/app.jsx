import { useState } from "react";
import "./app.scss";
import Download from "/icons/download.svg";
import Video from "/icons/video.svg";
import Music from "/icons/music.svg";
import AddLink from "/icons/addLink.svg";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const api = axios.create({
    baseURL: import.meta.env.VITE_BACK_END_URL
});

export default function Home() {
    const [typeArchive, setTypeArchive] = useState("Video");
    const [url, setUrl] = useState("");
    const [baixando, setBaixando] = useState(false);

    function extrairNomeArquivo(disposition, typeArchive) {
        let nomeArquivo = typeArchive === "Video" ? "video.mp4" : "music.mp3";
        if (disposition) {
            const match = disposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) {
                nomeArquivo = match[1];
            }
        }
        return nomeArquivo;
    }

    function dispararDownload(blob, nomeArquivo) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    async function baixarUm(urlVideo) {
        const response = await api.post(
            `/Install/${typeArchive}`,
            { url: urlVideo },
            { responseType: "blob" }
        );

        const disposition = response.headers["content-disposition"];
        const nomeArquivo = extrairNomeArquivo(disposition, typeArchive);

        dispararDownload(response.data, nomeArquivo);
    }

    async function DownloadType() {
        if (!url) {
            alert("Insira um link válido!");
            return;
        }

        setBaixando(true);
        try {
            const infoResp = await api.post("/GetPlaylist", { url });
            const info = infoResp.data;

            if (info.isPlaylist) {
                console.log(`Baixando playlist: ${info.title} (${info.videos.length} vídeos)`);

                for (let i = 0; i < info.videos.length; i++) {
                    const video = info.videos[i];
                    console.log(`Baixando ${i + 1}/${info.videos.length}: ${video.title}`);

                    await baixarUm(video.url);
                    await new Promise((r) => setTimeout(r, 500));
                }
            } else {
                await baixarUm(url);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao baixar. Verifique o link e tente novamente.");
        } finally {
            setBaixando(false);
        }
    }

    return (
        <main className="home">
            <h1 className="title">MgsDownloader</h1>

            <section className="card">
                <div className="options">
                    <div className="option">
                        <button
                            type="button"
                            className={`button ${typeArchive === "Video" ? "active" : ""}`}
                            onClick={() => setTypeArchive("Video")}
                        >
                            <img className="icon" src={Video} alt="" />
                            <span className="name">VÍDEO</span>
                        </button>
                        <span className="caption">VÍDEO</span>
                    </div>

                    <div className="option music">
                        <button
                            type="button"
                            className={`button ${typeArchive === "Music" ? "active" : ""}`}
                            onClick={() => setTypeArchive("Music")}
                        >
                            <img className="icon" src={Music} alt="" />
                            <span className="name">MÚSICA</span>
                        </button>
                        <span className="caption">MÚSICA</span>
                    </div>
                </div>

                <label className="url">
                    <img className="icon" src={AddLink} alt="" />
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Cole o link do vídeo ou música aqui..."
                    />
                </label>
            </section>

            <button
                type="button"
                className="download"
                onClick={DownloadType}
                disabled={baixando}
            >
                <img className="icon" src={Download} alt="" />
                <span className="text">{baixando ? "BAIXANDO..." : "BAIXAR"}</span>
            </button>
        </main>
    );
}