import '../styles/AddonModal.css';
import { proxy, useSnapshot } from 'valtio';
import { parse_submit_event } from '../utils/form_event_parse';

const modalState = proxy({
  header: '',
  description: '',
  placeholder: '',
  imageUrl: '',
  icon: '',
  open: false,
  renderInput: true,
  buttonText: '',
  productUid: '',
  renderBody: null as (() => React.ReactNode) | null,
  onSubmit: ({message}: {message: string}) => {},
  onClose: ()=>{}
});

function AddonModal() {
  const snap = useSnapshot(modalState);

  const onSubmit = (message: string)=>{
    modalState.onSubmit({message});
  }

  const onClose = ()=>{
    modalState.onClose();
  }

  const handleBackdropClick = ()=>{
    const text = getText();
    if (text){
      return
    }

    modalState.open = false;
    onClose();
  }
  const handleClose = ()=>{
    modalState.open = false;
    modalState.renderBody = null;
    onClose();
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = parse_submit_event(e);
    const message = form.message as string;
    onSubmit(message);
    modalState.open = false;
  };

  const getText = ()=>{
    const textarea = document.querySelector(".addon-modal-textarea") as HTMLTextAreaElement;
    return textarea?.value || "";
  }

  if (!snap.open){return null;}

  return (
    <div className="addon-modal-overlay" >
      <div onClick={handleBackdropClick} style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0

      }}></div>
      <div className="addon-modal">
        <button className="addon-modal-close" onClick={handleClose}>
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="addon-modal-image">
          {snap.imageUrl && <img src={snap.imageUrl} alt={snap.header} />}
          {snap.icon && !snap.imageUrl && <div className="addon-modal-image-placeholder">
              <i className={snap.icon} />
            </div>}
          <div className="addon-modal-image-gradient" />
        </div>

        <div className="addon-modal-content">
          <h2 className="addon-modal-title">{snap.header}</h2>
          {snap.renderBody ? snap.renderBody() : <p className="addon-modal-desc">{snap.description}</p>}
        </div>

        <form className="addon-modal-form" onSubmit={handleSubmit}>
          {snap.renderInput && <textarea
            className="addon-modal-textarea"
            name="message"
            placeholder="e.g. Hi! Leave us a message after the beep..."
          />}
          <button type="submit" className="addon-modal-submit">
            {snap.buttonText}
          </button>
          <p className="addon-modal-note">
            Our team will review and confirm within 24 hours
          </p>
        </form>
      </div>
    </div>
  );
}

export default AddonModal;
export { modalState };