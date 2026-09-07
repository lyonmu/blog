export const SITE = {
  website: "https://blog.muqingcloud.space/",
  author: "lyonmu",
  profile: "https://github.com/lyonmu",
  desc: "云原生知识花园 — 记录云原生、可观测性、智能运维与工程实践。",
  title: "lyonmu",
  ogImage: "og.png",
  lightAndDarkMode: true,
  postPerIndex: 6,
  postPerPage: 9,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    url: "",
    text: "编辑文章",
  },
  dynamicOgImage: true,
  dir: "auto", // "rtl" | "auto"
  lang: "zh",
  timezone: "Asia/Shanghai",
} as const;
