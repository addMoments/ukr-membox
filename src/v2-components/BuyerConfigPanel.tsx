import { useState } from 'react';
import { Product } from '../types/products';
import { CartItem } from '../types/carts';
import { t } from '../packages/i18n';
import '../v2-styles/BuyerConfigPanel.css';

interface ConfigField {
  key: string;
  label: string;
  type?: string;
  maxLength?: number;
}

interface Design {
  id: string;
  label: string;
  image: string;
}

interface BuyerConfigPanelProps {
  product: Product;
  cartItem: CartItem;
  onSubmit: (config: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

function BuyerConfigPanel({ product, cartItem, onSubmit, onClose }: BuyerConfigPanelProps) {
  const options = product.options || {};
  const designs: Design[] = options.designs || [];
  const configFields: ConfigField[] = options.config_fields || [];

  const existingConfig = cartItem.buyer_config || {};

  const [selectedDesign, setSelectedDesign] = useState<string>(
    existingConfig.design_id || (designs[0]?.id ?? '')
  );
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    configFields.forEach(f => { initial[f.key] = existingConfig[f.key] || ''; });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  const previewImage = designs.find(d => d.id === selectedDesign)?.image || options.image || '';

  const display = t('products.' + product.id, { returnObjects: true }) as { name?: string };
  const productName = display?.name || product.id;

  // Ne: Satin alma sonrasi eksik fiziksel add-on konfigurasyonunu kaydeder.
  // Nasil: Form state'indeki tum config_fields degerlerini toplar ve varsa secili design_id ile backend'e yollar.
  // Neden: Welcome Board ve QR Card gibi statik tasarimli add-on'larda gorsel degismez, ama secilen tasarim ve metinler buyer_config olarak saklanmalidir.
  const handleSubmit = async () => {
    setSubmitting(true);
    const config: Record<string, string> = { ...fieldValues };
    if (designs.length > 0) config.design_id = selectedDesign;
    try {
      await onSubmit(config);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bcp">
      <div className="bcp-inner">
        {/* Preview */}
        <div className="bcp-preview">
          {previewImage ? (
            <img src={previewImage} alt={productName} />
          ) : (
            <div className="bcp-preview-placeholder">
              <i className={options.icon || 'fa-solid fa-print'} />
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bcp-form">
          <div className="bcp-title">{productName}</div>

          {designs.length > 0 && (
            <div className="bcp-field">
              <label className="bcp-label">{t('addons.designLabel') || 'Design'}</label>
              <select
                className="bcp-select"
                value={selectedDesign}
                onChange={e => setSelectedDesign(e.target.value)}
              >
                {designs.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {configFields.map(field => {
            // footer_text sorusunu panel config formunda gecici olarak gizliyoruz.
            if (field.key === 'footer_text') return null;
            return (
              <div key={field.key} className="bcp-field">
                <label className="bcp-label">{field.label}</label>
                <textarea
                  className="bcp-textarea"
                  value={fieldValues[field.key] || ''}
                  onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  maxLength={field.maxLength}
                  rows={2}
                />
                {field.maxLength && (
                  <span className="bcp-char-count">
                    {(fieldValues[field.key] || '').length} / {field.maxLength}
                  </span>
                )}
              </div>
            );
          })}

          <div className="bcp-actions">
            <button className="bcp-submit-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '...' : (t('addons.submitConfig') || 'Submit Configuration')}
            </button>
            <button className="bcp-cancel-btn" onClick={onClose}>
              {t('addons.cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuyerConfigPanel;
