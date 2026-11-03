import '../v2-styles/AdvertorialImage.css';

// Misafir ana sayfasindaki reklam hucresinin gorseli. Host ayarlarindaki onizleme de bunu
// kullanir, boylece host misafirin gordugu kutuyu gorur (Solomiia 19 Ekim aksami: 16:9
// onizlemede 1600x800 reklam ust/altta bosluk birakip eksik gibi gorunuyordu).

// Ne: Reklam gorseli hucreyi tamamen doldurur (cover); hucreye uymayan kisim ortadan kirpilir.
// Neden: 19 Ekim'den beri gorsel butun gosterilip kalan bosluk gorselin kenar rengiyle
//        boyaniyordu. Hucre 41:20, yonerge 2:1 (1600x800); aradaki fark her yanda ~%1,2'lik
//        bir serit birakiyordu. Kenari tek renk olmayan reklamlarda bu serit kenar boslugu gibi
//        gorundu ve Solomiia (3 Kasim) efektin kaldirilmasini istedi. 2:1 gorselde kirpma
//        ust ve altta ~%1,2; baska oranlar daha cok kirpilir, host bunu ayarlardaki ayni
//        onizlemede gorur. Renk okumak icin gereken CORS yuklemesi (?am=c) da kalkti.
function AdvertorialImage({ src, alt = '' }: { src: string; alt?: string }) {
  return (
    <span className="advertorial-image">
      <img src={src} alt={alt} loading="lazy" />
    </span>
  );
}

export default AdvertorialImage;
