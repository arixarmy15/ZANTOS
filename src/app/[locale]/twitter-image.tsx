import { socialImage, socialImageMetadata } from "./social-image";

type Props = { params: Promise<{ locale: string }> };

export function generateImageMetadata({ params }: { params: { locale?: string } }) {
  return socialImageMetadata(params?.locale);
}

export default function Image({ params }: Props) {
  return socialImage(params);
}
