import type { Metadata } from "next";

export const SITE_NAME = "곡소리닷컴";
export const SITE_URL = "https://goksorry.com";
export const SITE_DESCRIPTION = "커뮤니티 체감 지수, 시장 개요, 종목 커뮤니티를 함께 보는 곡소리닷컴";
const DEFAULT_SOCIAL_IMAGE_URL = "/goksorry_logo.png";

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

export const summarizeText = (value: string, maxLength = 160): string => {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

type BuildPageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  openGraphType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export const buildPageMetadata = ({
  title,
  description,
  path,
  index = true,
  openGraphType = "website",
  publishedTime,
  modifiedTime
}: BuildPageMetadataOptions): Metadata => {
  const normalizedTitle = normalizeText(title) || SITE_NAME;
  const normalizedDescription = summarizeText(description) || SITE_DESCRIPTION;

  return {
    title: normalizedTitle,
    description: normalizedDescription,
    alternates: {
      canonical: path
    },
    robots: index
      ? {
          index: true,
          follow: true
        }
      : {
          index: false,
          follow: false,
          nocache: true
        },
    openGraph: {
      type: openGraphType,
      title: normalizedTitle,
      description: normalizedDescription,
      url: path,
      siteName: SITE_NAME,
      locale: "ko_KR",
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE_URL,
          alt: `${SITE_NAME} 로고`
        }
      ],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {})
    },
    twitter: {
      card: "summary",
      title: normalizedTitle,
      description: normalizedDescription,
      images: [DEFAULT_SOCIAL_IMAGE_URL]
    }
  };
};

export const buildNoIndexMetadata = (title: string, description: string): Metadata => ({
  title: normalizeText(title),
  description: summarizeText(description),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
});
