import { InputHTMLAttributes, useState } from "react";
import "../v2-styles/PasswordInput.css";
import { textOr } from "../utils/admin_i18n";

// Ne: Sifre alanini, icinde goster/gizle gozu olan bir input'a cevirir.
// Nasil: Input bir sarmalayiciya alinir, gozu type="button" olarak sagda konumlanir ve
//        tiklandiginda input type'i password <-> text arasinda degisir.
// Neden: Kullanici yazdigi sifreyi dogrulayabilsin. Dugmenin type="button" olmasi sart,
//        aksi halde form icinde varsayilan submit dugmesi gibi davranip formu gonderir.
//        Dugmeye name verilmez; form_event_parse "*[name]" ile topladigi icin
//        aksi halde gonderilen veriye sizardi.
interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  className?: string;
  wrapperClassName?: string;
}

const PasswordInput = ({
  className = "",
  wrapperClassName = "",
  ...inputProps
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  // Ceviri JSON'u uzaktan geldigi icin anahtar bulunamazsa ham key ekrana dusuyordu;
  // textOr bu durumda EN/UK metnine duser.
  const label = visible
    ? textOr("auth.hidePassword", "Hide password", "Приховати пароль")
    : textOr("auth.showPassword", "Show password", "Показати пароль");

  return (
    <div className={`pw-field ${wrapperClassName}`.trim()}>
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={`${className} pw-input`.trim()}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setVisible((v) => !v)}
        // Sifre alani disabled ise gozun de kapali olmasi gerekiyor.
        disabled={inputProps.disabled}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        // Klavyeyle alanlar arasinda gezerken goz dugmesi araya girmesin.
        tabIndex={-1}
      >
        <i
          className={visible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}
          aria-hidden="true"
        ></i>
      </button>
    </div>
  );
};

export default PasswordInput;
