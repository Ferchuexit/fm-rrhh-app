"use client";
// FM RRHH — app/Buscador.tsx
// El buscador de la barra de arriba: personas y pantallas (/api/buscar).
// Se abre con Ctrl+K o con "/" (fuera de un campo de texto); flechas para
// moverse, Enter para ir, Escape para cerrar.
import { useEffect, useRef, useState } from "react";

type Pantalla = { href: string; label: string; icono: string; categoria: string };
type Persona = { id: string; nombre: string; legajo: number; sector: string; activo: boolean; href: string };
type Resultado = { href: string; titulo: string; sub: string; icono: string; grupo: string };

export default function Buscador() {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [res, setRes] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "") || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !enCampo)) { e.preventDefault(); input.current?.focus(); setAbierto(true); }
    };
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    window.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fuera);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fuera); };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const control = new AbortController();
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(q.trim())}`, { signal: control.signal });
        const d = await r.json();
        if (r.ok) {
          setRes([
            ...(d.personas as Persona[]).map((p) => ({ href: p.href, titulo: p.nombre, sub: `Leg. ${p.legajo}${p.sector ? ` · ${p.sector}` : ""}${p.activo ? "" : " · de baja"}`, icono: "👤", grupo: "Personas" })),
            ...(d.pantallas as Pantalla[]).map((p) => ({ href: p.href, titulo: p.label, sub: p.categoria, icono: p.icono, grupo: "Pantallas" })),
          ]);
          setSel(0);
        }
      } catch {}
      setCargando(false);
    }, 200);
    return () => { clearTimeout(t); control.abort(); };
  }, [q]);

  function ir(r: Resultado) { setAbierto(false); setQ(""); window.location.href = r.href; }
  function teclas(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setAbierto(false); input.current?.blur(); return; }
    if (!res.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % res.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + res.length) % res.length); }
    if (e.key === "Enter") { e.preventDefault(); ir(res[sel]); }
  }

  const mostrar = abierto && q.trim().length >= 2;
  return (
    <div className="bs" ref={caja}>
      <span className="bs-lupa" aria-hidden="true">⌕</span>
      <input
        ref={input} className="bs-input" type="search" value={q} placeholder="Buscar persona o pantalla"
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onKeyDown={teclas}
        role="combobox" aria-expanded={mostrar} aria-controls="bs-lista" aria-autocomplete="list" aria-label="Buscar persona o pantalla (Ctrl+K)"
        aria-activedescendant={mostrar && res[sel] ? `bs-op-${sel}` : undefined}
      />
      <kbd className="bs-atajo" aria-hidden="true">Ctrl K</kbd>
      {mostrar && (
        <div className="bs-lista" id="bs-lista" role="listbox">
          {res.length === 0 && <div className="bs-vacio">{cargando ? "Buscando…" : "Nada con ese nombre."}</div>}
          {res.map((r, i) => (
            <div key={r.href + i}>
              {(i === 0 || res[i - 1].grupo !== r.grupo) && <div className="bs-grupo">{r.grupo}</div>}
              <a id={`bs-op-${i}`} role="option" aria-selected={i === sel} href={r.href} className={`bs-op${i === sel ? " sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={(e) => { e.preventDefault(); ir(r); }}>
                <span className="bs-ico" aria-hidden="true">{r.icono}</span>
                <span><span className="bs-tit">{r.titulo}</span><span className="bs-sub">{r.sub}</span></span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
