import { useEffect, useRef, ReactNode, InputHTMLAttributes } from "react";

interface FileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'style' | 'multiple'> {
  onFile: (file: File) => void;
  children: ReactNode;
  mimeTypes?: string[];
  className?: string;
  multiple?: boolean;
}

const eventAdd = (
  domElement: HTMLElement,
  eventType: string,
  func: (event: Event) => void
) => {
  domElement.addEventListener(eventType, func);
  return () => {
    domElement.removeEventListener(eventType, func);
  };
};

function FileInput({
  onFile,
  children,
  mimeTypes,
  className = "",
  multiple = false,
  ...rest
}: FileInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (mimeTypes && !mimeTypes.includes(file.type)) {
      console.warn("invalid file type:", file.type);
      return;
    }
    onFile(file);
  };

  const getFile = (event: Event) => {
    event.preventDefault();
    const dragEvent = event as DragEvent;
    const files = dragEvent.dataTransfer?.files;
    if (!files) return;

    if (multiple) {
      Array.from(files).forEach(handleFile);
    } else {
      handleFile(files[0]);
    }
  };

  const askFile = (event: Event) => {
    event.preventDefault();
    const fileInput = inputRef.current;
    if (!fileInput) return;

    fileInput.onchange = () => {
      const files = fileInput.files;
      if (!files) return;

      if (multiple) {
        Array.from(files).forEach(handleFile);
      } else {
        handleFile(files[0]);
      }
      fileInput.value = "";
    };
    fileInput.click();
  };

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const unsubFuncs = [
      eventAdd(wrapper, "dragover", (ev) => ev.preventDefault()),
      eventAdd(wrapper, "drop", getFile),
      eventAdd(wrapper, "click", askFile),
    ];

    return () => {
      unsubFuncs.forEach((unsub) => unsub());
    };
  }, []);

  return (
    <>
      <div
        className={"file-input-wrapper " + className}
        style={{ cursor: "pointer" }}
        ref={wrapperRef}
      >
        {children}
      </div>
      <input
        {...rest}
        accept={mimeTypes ? mimeTypes.join(",") : "*"}
        ref={inputRef}
        type="file"
        multiple={multiple}
        style={{ display: "none" }}
      />
    </>
  );
}

export default FileInput;

