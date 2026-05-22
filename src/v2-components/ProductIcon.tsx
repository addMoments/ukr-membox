import '../v2-styles/EventNew.css';

interface ProductIconProps {
  icon: string;
  size?: number;
}

function ProductIcon({ icon, size }: ProductIconProps) {
  const sizeStyle = size ? { width: size, height: size } : undefined;
  
  return (
    <div className="event-new-addon-icon-wrap" style={sizeStyle}>
      <i className={icon + " event-new-addon-icon"}></i>
    </div>
  );
}

export default ProductIcon;
