import Button, { ButtonProps } from '../components/Button';
import '../v2-styles/ColoredSettingsBox.css';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const ColoredSettingsBox = ({
  title,
  descriptionS,
  color,
  buttonPropsS,
  children
}: {
  title: string;
  descriptionS: string[];
  color: string; // hex like #DC2626
  buttonPropsS: (ButtonProps | null)[];
  children?: React.ReactNode;
}) => {
  const rgb = hexToRgb(color);
  const rgba = (opacity: number, irgb = rgb) => `rgba(${irgb.r}, ${irgb.g}, ${irgb.b}, ${opacity})`;

  const titleDarker = 0.6;
  const titleRgb = {
    r: rgb.r * titleDarker,
    g: rgb.g * titleDarker,
    b: rgb.b * titleDarker
  }

  return (
    <section 
      className="csbox" 
      style={{ 
        background: rgba(0.03), 
        border: `1px solid ${rgba(0.2)}` 
      }}
    >
      <div className="csbox-content">
        <div className="csbox-text">
          <h2 className="csbox-title" style={{ color: rgba(1, titleRgb) }}>{title}</h2>
          {descriptionS.filter(Boolean).map((description, index) => (
            <p className="csbox-description" style={{ color: rgba(0.7, titleRgb) }} key={index}>{description}</p>
          ))}
        </div>
        <div className="csbox-actions">
          {buttonPropsS.filter(Boolean).map((buttonProps, index) => (
            <Button {...buttonProps!} style={{
              background: 'white',
              border: `1px solid ${rgba(0.2)}`,
              color: rgba(1),
              ...buttonProps!.style
            }} key={index}  />
          ))}
        {children}
        </div>
      </div>
    </section>
  );
}

export default ColoredSettingsBox;
