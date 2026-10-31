# Jumpscare próprio

Coloque aqui os seus arquivos (o primeiro que existir — e que o navegador
consiga tocar — de cada linha vale):

| O quê  | Nome do arquivo                            | Como entra |
|--------|--------------------------------------------|------------|
| Vídeo  | `jumpscare.webm` e/ou `jumpscare.mp4`      | Vira o susto **"Ele corre" (`video`)**: entra no sorteio dos assustadores, no botão do host e nos momentos importantes dos jogos (TV **e** celulares). |
| Imagem | `jumpscare.gif`, `.webp`, `.png` ou `.jpg` | Troca o Penetra desenhado (o susto raro, 1 em 5000 por segundo). |
| Som    | `jumpscare.mp3`, `.ogg` ou `.wav`          | Toca com o Penetra. |

## O vídeo que está aqui

- `jumpscare.webm` — VP9 **com transparência** (o fundo verde foi recortado)
  e áudio Opus já comprimido e alto. Chrome, Edge, Firefox e Android usam este.
- `jumpscare.mp4` — o mesmo recorte sobre fundo preto (H.264 + AAC), para
  navegadores que não tocam webm.

Na tela: meio segundo de escuro e silêncio, e o vídeo entra sobre um fundo
vermelho-escuro; o último quadro fica parado até a cena sumir. O som do
vídeo passa pelo caminho ALTO dos sustos (saturação + limitador, e no mínimo
90% do volume mesmo com o volume do app baixo). O mudo continua mudo.

## Trocar por outro vídeo com fundo verde

```sh
V=seu-video.mp4
# webm com transparência (cor sob o transparente = preto)
ffmpeg -i "$V" -filter_complex "[0:v]chromakey=0x00FE00:0.18:0.06,despill=type=green:mix=0.6:expand=0.1,split[k][m];[m]alphaextract[a];color=c=black:s=WxH:r=30[bg];[bg][k]overlay=shortest=1[rgb];[rgb][a]alphamerge,format=yuva420p[v]" \
  -map "[v]" -map 0:a -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 900k -crf 30 \
  -af "acompressor=threshold=-24dB:ratio=6:attack=2:release=80:makeup=8,volume=4dB,alimiter=limit=0.94" -c:a libopus jumpscare.webm
```

Troque `WxH` pelo tamanho do vídeo e `0x00FE00` pela cor exata do verde.
Faça o `.mp4` igual, só sem o `alphamerge` (overlay sobre preto, `libx264`/`aac`).

- A TV e os celulares carregam os arquivos ao abrir: depois de trocar, recarregue.
- Para ver na hora: fantasminha no canto da TV → "Testar susto", ou o botão
  "🦊 Ele corre" no celular do host.
- Use arquivos que você pode usar. Se o repositório for público, eles vão
  junto para o GitHub e para o site.
