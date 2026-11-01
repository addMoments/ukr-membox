// Ne: Ek urun kartinin masaustu ve mobil gorseli.
// Nasil: Ozel paketler sayfasinda (ve sepette ozel paket varken odeme sayfasinda) admin'in o sayfa icin yukledigi
//        options.special_image / special_mobile_image kullanilir; ozel masaustu gorseli varken eksik mobil gorsel
//        ona duser (dugun temali mobil gorsele degil). Ozel gorsel yoksa Services & Prices'taki gorseller.
// Neden: Musteri 29 Ekim: Services & Prices'taki gorseller aynen kalsin, ozel paketler sayfasinda School/Hero
//        temasina uyan gorseller bagimsiz degissin.
export const addonImages = (options: Record<string, any> | undefined, special: boolean) => {
  const specialImage = options?.special_image as string | undefined;
  const specialMobileImage = options?.special_mobile_image as string | undefined;
  if (special && (specialImage || specialMobileImage)) {
    return {
      image: specialImage || (options?.image as string | undefined),
      mobileImage: specialMobileImage || (specialImage ? undefined : (options?.mobile_image as string | undefined)),
    };
  }
  return {
    image: options?.image as string | undefined,
    mobileImage: options?.mobile_image as string | undefined,
  };
};
