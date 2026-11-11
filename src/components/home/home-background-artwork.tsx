import Image from "next/image";
import { HOME_BACKGROUND_SAMPLES, homeBackgroundImage, type HomeBackgroundId } from "@/lib/home-backgrounds";
import styles from "./home-background-artwork.module.css";

export function HomeBackgroundArtwork({ id }: { id: HomeBackgroundId }) {
  const split = HOME_BACKGROUND_SAMPLES.some((background) => background.id === id);
  const source = homeBackgroundImage(id);

  return (
    <div className={styles.artwork} aria-hidden="true">
      {split ? (
        <>
          <div className={styles.left}>
            <Image src={source} alt="" width={1672} height={941} unoptimized className={styles.sideImage} />
          </div>
          <div className={styles.right}>
            <Image src={source} alt="" width={1672} height={941} unoptimized className={styles.sideImage} />
          </div>
        </>
      ) : <Image src={source} alt="" fill unoptimized className="object-cover" />}
    </div>
  );
}
