import { useState, type InputHTMLAttributes } from 'react';
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };
export function LaserInput({ label, className, onFocus, onBlur, ...rest }: Props) {
 const [lit,setLit] = useState(false);
 return <label className={`obn-field ${className ?? ''}`}><span className="obn-field__label">{label}</span><span className="obn-field__shell" data-lit={lit}><input className="obn-field__input" {...rest} onFocus={e=>{setLit(true);onFocus?.(e)}} onBlur={e=>{setLit(false);onBlur?.(e)}}/><span className="obn-field__laser" aria-hidden="true"/></span></label>;
}
