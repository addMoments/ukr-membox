type FormState = Record<string, any>;

type DomElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface TypeProcessor {
    process_this: (el: DomElement) => boolean;
    f: (el: DomElement) => any;
    put: (dom_elem: DomElement, value: any) => void;
}

const defaultPut = (dom_elem: DomElement, value: any): void => {
    (dom_elem as HTMLInputElement).value = value;
};

const submit_parser_settings = {
    default_type_f: (el: DomElement = document.querySelector("input")!): string => {
        return (el as HTMLInputElement).value;
    },
    default_put: defaultPut,

    type_processors: [
        {
            process_this: (el: DomElement): boolean => ["number"].includes((el as HTMLInputElement).type),
            f: (el: DomElement): number => +(el as HTMLInputElement).value,
            put: defaultPut,
        },
        {
            process_this: (el: DomElement): boolean => ["checkbox"].includes((el as HTMLInputElement).type),
            f: (el: DomElement): boolean => (el as HTMLInputElement).checked,
            put: (dom_elem: DomElement, value: boolean): void => {
                (dom_elem as HTMLInputElement).checked = value;
            }
        },
        {
            process_this: (el: DomElement): boolean => ["radio"].includes((el as HTMLInputElement).type),
            f: (el: DomElement): string => {
                const name = el.getAttribute("name");
                return (document.querySelector(`input[type="radio"][name="${name}"]:checked`) as HTMLInputElement).value;
            },
            put: (dom_elem: DomElement, value: string): void => {
                const name = dom_elem.getAttribute("name");
                const radio = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`) as HTMLInputElement;
                if (radio) radio.checked = true;
            }
        },
        {
            process_this: (el: DomElement): boolean => el.tagName === 'SELECT',
            f: (el: DomElement): string | null => {
                const select = el as HTMLSelectElement;
                const selectedOption = select.options[select.selectedIndex];
                return selectedOption ? selectedOption.value : null;
            },
            put: (dom_elem: DomElement, value: string): void => {
                const option = dom_elem.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
                if (option) {
                    option.selected = true;
                }
            }
        },
        {
            process_this: (el: DomElement): boolean => {
                const input = el as HTMLInputElement;
                return !!(input.type === 'date');
            },
            f: (el: DomElement): string => {
                return new Date(el.value).toISOString();
            },
            put: (dom_elem: DomElement, value: string): void => {
                (dom_elem as HTMLInputElement).value = new Date(value).toISOString().split('T')[0];
            }
        },
        {
            process_this: (el: DomElement): boolean => {
                const input = el as HTMLInputElement;
                return !!(input.type === 'datetime-local');
            },
            f: (el: DomElement): string => {
                return new Date((el as HTMLInputElement).value).toISOString();
            },
            put: (dom_elem: DomElement, value: number): void => {
                (dom_elem as HTMLInputElement).value = new Date(value).toISOString();
            }
        },
        {
            process_this: (el: DomElement): boolean => {
                const input = el as HTMLInputElement;
                return !!(input.type === 'file');
            },
            f: (el: DomElement): File[] => {
                const files = (el as HTMLInputElement).files;
                return files ? Array.from(files) : [];
            },
            put: (dom_elem: DomElement): void => {
            }
        },
    ] as TypeProcessor[],
};

const put_form_state = (elem: HTMLElement, state: FormState): void => {
    const inputs = elem.querySelectorAll("*[name]") as NodeListOf<DomElement>;

    for (let i = 0; i < inputs.length; i++) {
        let is_proc = false;
        const v = state[inputs[i].getAttribute("name")!];
        if (!v) { return; }

        for (let j = 0; j < submit_parser_settings.type_processors.length; j++) {
            if (submit_parser_settings.type_processors[j].process_this(inputs[i])) {
                submit_parser_settings.type_processors[j].put(inputs[i], v);
                is_proc = true;
                break;
            }
        }

        if (!is_proc) {
            submit_parser_settings.default_put(inputs[i], v);
        }
    }
};

const parse_submit_event = (e: React.FormEvent<HTMLFormElement>): FormState => {
    e.preventDefault();

    const target = e.target as HTMLFormElement;
    
    return get_form_state(target);
};

const get_form_state = (target: HTMLFormElement): FormState => {
    const inp_keys = Object.keys(target).filter(k => !isNaN(Number(k)) && !!(target as any)[k]["name"]);
    const form_state: FormState = {};
    
    for (let i = 0; i < inp_keys.length; i++) {
        const el = (target as any)[inp_keys[i]] as DomElement;

        if ((el as HTMLInputElement).disabled) continue;

        let val: any;
        let is_proc = false;

        for (let j = 0; j < submit_parser_settings.type_processors.length; j++) {
            if (submit_parser_settings.type_processors[j].process_this(el)) {
                val = submit_parser_settings.type_processors[j].f(el);
                is_proc = true;
                break;
            }
        }

        if (!is_proc) {
            val = submit_parser_settings.default_type_f(el);
        }

        form_state[el.name] = val;
    }

    return form_state;
}

export {
    parse_submit_event,
    put_form_state,
    get_form_state
};

export type { FormState, DomElement, TypeProcessor };

