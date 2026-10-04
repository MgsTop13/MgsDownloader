import { useState } from "react";
import "./app.scss";
import Download from "/icons/download.svg";
import Video from "/icons/video.svg";
import Music from "/icons/music.svg";
import AddLink from "/icons/addLink.svg";
import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:5010",
});

function extrairNomeArquivo(disposition, typeArchive) {
    const fallback = typeArchive === "Video" ? "video.mp4" : "music.mp3";
    if (!disposition) return fallback;

    const matchUtf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (matchUtf8) return decodeURIComponent(matchUtf8[1]);

    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match?.[1] || fallback;
}

function dispararDownload(blob, nomeArquivo) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export default function Home() {
    const [typeArchive, setTypeArchive] = useState("Video");
    const [url, setUrl] = useState("");
    const [baixando, setBaixando] = useState(false);
    const [progresso, setProgresso] = useState("");


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

    async function handleDownload() {
        if (!url.trim()) {
            alert("Insira um link válido!");
            return;
        }

        setBaixando(true);
        setProgresso("");

        try {
            const { data: info } = await api.post("/GetPlaylist", { url });

            if (info.isPlaylist) {
                const total = info.videos.length;
                for (let i = 0; i < total; i++) {
                    const video = info.videos[i];
                    setProgresso(`Baixando ${i + 1}/${total}: ${video.title}`);
                    await baixarUm(video.url);
                    // pequena pausa para não sobrecarregar
                    await new Promise((r) => setTimeout(r, 500));
                }
            } else {
                setProgresso("Baixando...");
                await baixarUm(url);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao baixar. Verifique o link e tente novamente.");
        } finally {
            setBaixando(false);
            setProgresso("");
        }
    }

    return (
        <main className="home">
            <h1 className="title">Mgs - Downloader</h1>

            <section className="card">
                <div className="options">
                    <div className="option">
                        <button
                            type="button"
                            className={`button ${typeArchive === "Video" ? "active" : ""}`}
                            onClick={() => setTypeArchive("Video")}
                            disabled={baixando}
                        >
                            <img className="icon" src={Video} alt="" />
                            <span className="name">Vídeo</span>
                        </button>
                    </div>

                    <div className="option music">
                        <button
                            type="button"
                            className={`button ${typeArchive === "Music" ? "active" : ""}`}
                            onClick={() => setTypeArchive("Music")}
                            disabled={baixando}
                        >
                            <img className="icon" src={Music} alt="" />
                            <span className="name">Música</span>
                        </button>
                    </div>
                </div>

                <label className="url">
                    <img className="icon" src={AddLink} alt="" />
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Cole o link do vídeo ou música aqui..."
                        disabled={baixando}
                    />
                </label>
            </section>

            <button
                type="button"
                className="download"
                onClick={handleDownload}
                disabled={baixando}
            >
                <img className="icon" src={Download} alt="" />
                <span className="text">
                    {baixando ? progresso || "Baixando..." : `Baixar ${typeArchive}`}
                </span>
            </button>
        </main>
    );
}