export function limparTitulo(titulo) {
    return titulo
        .replace(/\.(mp3|mp4|wav|webm|m4a|ogg|flac|aac|opus)$/i, '')
        .replace(/[\\/:*?"<>|]/g, '')
        .trim();
}