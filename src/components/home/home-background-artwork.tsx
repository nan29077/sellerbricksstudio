import Image from "next/image";
import { HOME_BACKGROUND_SAMPLES, MINIATURE_HOME_BACKGROUNDS, homeBackgroundImage, type HomeBackgroundId } from "@/lib/home-backgrounds";
import styles from "./home-background-artwork.module.css";

export function HomeBackgroundArtwork({ id }: { id: HomeBackgroundId }) {
  const miniature = MINIATURE_HOME_BACKGROUNDS.some((background) => background.id === id);
  const split = miniature || HOME_BACKGROUND_SAMPLES.some((background) => background.id === id);
  const sideClass = miniature ? styles.edgeImage : styles.sideImage;
  const source = homeBackgroundImage(id);

  return (
    <div className={miniature ? `${styles.artwork} ${styles.edgeArtwork}` : styles.artwork} aria-hidden="true">
      {split ? (
        <>
          <div className={styles.left}>
            <Image src={source} alt="" width={1672} height={941} unoptimized className={sideClass} />
          </div>
          <div className={styles.right}>
            <Image src={source} alt="" width={1672} height={941} unoptimized className={sideClass} />
          </div>
        </>
      ) : <Image src={source} alt="" fill unoptimized className="object-cover" />}
    </div>
  );
}
