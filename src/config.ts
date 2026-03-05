export const SITE = {
  website: "https://blog.muqingcloud.space/",
  author: "lyonmu",
  profile: "https://github.com/lyonmu",
  desc: "博客，记录学习和工作中的点滴。",
  title: "lyonmu",
  ogImage: "devosfera-og.webp", // ubicado en la carpeta public
  lightAndDarkMode: true,
  postPerIndex: 6,
  postPerPage: 8,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showGalleries: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    url: "",
    text: "Edit this post",
  },
  dynamicOgImage: true,
  dir: "auto", // "rtl" | "auto"
  lang: "zh",
  timezone: "Asia/Shanghai",
  introAudio: {
    enabled: true, // mostrar/ocultar el reproductor en el hero
    src: "/audio/intro-web.mp3", // ruta al archivo (relativa a /public)
    label: "INTRO.MP3", // etiqueta display en el reproductor
    duration: 30, // duración en segundos (para la barra de progreso fija)
  },
} as const;
