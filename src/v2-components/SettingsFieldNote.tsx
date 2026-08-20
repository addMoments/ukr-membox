import { ReactNode } from 'react';
import '../v2-styles/SettingsFieldNote.css';

// Ne: Ayarlar formundaki bir alanin altinda duran, ikonlu bilgi kutusu.
// Nasil: Duz <p> yerine kutu; birden fazla paragraf verilebilir, aralarini CSS acar.
// Neden: Aktivasyon tarihi gibi geri alinamaz alanlarda aciklama metni duz hint olarak
//        gozden kaciyordu; musteri bu uyarilarin kutu icinde gosterilmesini istedi.
const SettingsFieldNote = ({ children }: { children: ReactNode }) => (
  <div className="settings-field-note">
    <i className="fa-solid fa-circle-info settings-field-note-icon" aria-hidden="true"></i>
    <div className="settings-field-note-body">{children}</div>
  </div>
);

export default SettingsFieldNote;
