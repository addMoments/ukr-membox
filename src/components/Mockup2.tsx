import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/Mockup2.css';

interface MockupProps {
  children: React.ReactNode;
  mockupImage: string;
  placement: MockupPlacement;
  width: number;
  simulatedWidth?: number;
  noscroll?: boolean;
}

interface MockupPlacement{
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
}

function copyStylesToIframe(iframeDoc: Document) {
  // Clear existing styles in iframe head (except our marker)
  const existingStyles = iframeDoc.head.querySelectorAll('style, link[rel="stylesheet"]');
  existingStyles.forEach(s => s.remove());

  // Copy all stylesheets from parent document
  const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
  parentStyles.forEach((style) => {
    const clone = style.cloneNode(true) as HTMLElement;
    iframeDoc.head.appendChild(clone);
  });
}

export default function Mockup({
  children,
  mockupImage,
  placement,
  width,
  simulatedWidth= 375,
  noscroll= false,
}: MockupProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [iframeBody, setIframeBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Initialize the iframe document
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
    doc.close();

    // Style the body
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.overflow = 'hidden';
    doc.body.style.overflowY = noscroll ? 'hidden' : 'auto';
    doc.body.style.height = '100%';
    doc.documentElement.style.height = '100%';
    doc.documentElement.classList.add('iframe');

    // Copy initial styles
    copyStylesToIframe(doc);

    setIframeBody(doc.body);

    // Watch for new styles being added (HMR in dev, lazy-loaded CSS, etc.)
    const observer = new MutationObserver(() => {
      copyStylesToIframe(doc);
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const imgAspect = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
    const containerHeight = width/imgAspect;
    const phoneAspect = (width * placement.widthPercent)/(containerHeight * placement.heightPercent);
    const phoneHeight = simulatedWidth / phoneAspect;
    const phoneRealHeight = containerHeight * placement.heightPercent / 100;
    const phoneScale = phoneRealHeight / phoneHeight;

    if (iframeRef.current) {
      const s = iframeRef.current.style;
      s.transform = `scale(${phoneScale})`;
      s.height = phoneHeight+6 + 'px'
      s.marginTop = width/imgAspect * placement.topPercent / 100 -3 + "px"
    };

    if (containerRef.current) {
      const s = containerRef.current.style;
      s.height = containerHeight + 'px';
    }
  }

  return (
    <div style={{position: 'relative'}} className="mockup2">
      <img onLoad={onImgLoad} style={{width: width, position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none'}} src={mockupImage} alt="Mockup" className="mockup-image" />
      <div style={{width: width}} className="mockup2-phone">
        <div 
          ref={containerRef} 
          className="mockup2-screen-container"
        >
          <iframe
            ref={iframeRef}
            className="mockup2-screen"
            title="Mobile Preview"
            style={{
              width: simulatedWidth+4,
              marginLeft: (width * placement.leftPercent / 100) -2,
              transformOrigin: 'top left',
            }}
          />
        </div>
        {iframeBody && createPortal(children, iframeBody)}
      </div>
    </div>
  );
}

