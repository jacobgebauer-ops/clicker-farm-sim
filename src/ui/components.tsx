import type { ComponentChildren, JSX } from 'preact';
import { entry, assetUrl, hasRealArt, hasFrameArt, realFrameCount } from '../game/assets';
import * as G from '../core';
import { store } from './store';
import { sfx } from '../audio/audio';
import { webPlatform } from '../platform/web';

const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

/** Size in CSS px for `art` pixels so each art pixel maps to a whole number of device pixels. */
export function crisp(art: number, scale = 1): number {
  const k = Math.max(1, Math.round(DPR * scale));
  return (art * k) / DPR;
}

export function Sprite({ id, frame = 0, scale = 1, class: cls, title, tint }: { id: string; frame?: number; scale?: number; class?: string; title?: string; tint?: string }) {
  const e = entry(id);
  const w = e?.w ?? 32;
  const h = e?.h ?? 32;
  const frames = e?.frames ?? 1;
  const cw = crisp(w, scale);
  const ch = crisp(h, scale);
  const style: JSX.CSSProperties = {
    width: `${cw}px`,
    height: `${ch}px`,
    backgroundImage: `url(${assetUrl(id)})`,
    backgroundSize: `${cw * frames}px ${ch}px`,
    backgroundPosition: `${-cw * Math.min(frame, frames - 1)}px 0`,
  };
  if (hasFrameArt(id, frame)) {
    // final art for just this frame, fitted inside the slot box
    style.backgroundImage = `url(${assetUrl(id, frame)})`;
    style.backgroundSize = 'contain';
    style.backgroundPosition = 'center bottom';
  } else if (hasRealArt(id)) {
    // final art keeps its own resolution and is fitted inside the slot box
    const rf = realFrameCount(id);
    style.backgroundSize = rf > 1 ? `${rf * 100}% 100%` : 'contain';
    style.backgroundPosition = rf > 1 ? `${(Math.min(frame, rf - 1) / (rf - 1)) * 100}% 0` : 'center bottom';
  }
  if (tint) {
    // grayscale layer tinted with multiply, masked to the sprite's shape so shading survives
    const mask = `url(${assetUrl(id)})`;
    const overlay: JSX.CSSProperties = {
      position: 'absolute', inset: '0', backgroundColor: tint, mixBlendMode: 'multiply',
      maskImage: mask, WebkitMaskImage: mask, maskSize: style.backgroundSize as string, WebkitMaskSize: style.backgroundSize as string,
      maskPosition: style.backgroundPosition as string, WebkitMaskPosition: style.backgroundPosition as string, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
    };
    return (
      <span class={`sprite ${cls ?? ''}`} style={{ ...style, position: 'relative' }} title={title}>
        <span style={overlay} />
      </span>
    );
  }
  return <span class={`sprite ${cls ?? ''}`} style={style} title={title} role={title ? 'img' : undefined} aria-label={title} />;
}

export function ItemIcon({ id, scale = 1 }: { id: string; scale?: number }) {
  return <Sprite id={`item_${id.split('@')[0]}`} scale={scale} title={G.itemName(id)} />;
}

export function Btn(props: {
  onClick?: () => void;
  children: ComponentChildren;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
  disabled?: boolean;
  small?: boolean;
  wide?: boolean;
  testid?: string;
  title?: string;
}) {
  return (
    <button
      class={`btn btn-${props.kind ?? 'primary'} ${props.small ? 'btn-small' : ''} ${props.wide ? 'btn-wide' : ''}`}
      disabled={props.disabled}
      data-testid={props.testid}
      title={props.title}
      onClick={(e) => {
        e.stopPropagation();
        if (props.disabled) return;
        sfx('tap');
        webPlatform.haptic('light');
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Coins({ n, size = 1 }: { n: number; size?: number }) {
  const fmt = store.state?.settings.numberFormat ?? 'short';
  return (
    <span class="money">
      <Sprite id="ui_coin" scale={size * 0.5} />
      {G.formatNumber(n, fmt)}
    </span>
  );
}

export function Ribbons({ n }: { n: number }) {
  return (
    <span class="money">
      <Sprite id="ui_ribbon" scale={0.5} />
      {n}
    </span>
  );
}

export function Cost({ coins, materials, ribbons }: { coins?: number; materials?: { id: string; qty: number }[]; ribbons?: number }) {
  const s = store.state;
  return (
    <span class="cost">
      {coins ? <Coins n={coins} /> : null}
      {ribbons ? <Ribbons n={ribbons} /> : null}
      {(materials ?? []).map((m) => (
        <span class={`mat ${G.count(s, m.id) >= m.qty ? '' : 'short'}`} key={m.id}>
          <ItemIcon id={m.id} scale={0.5} />
          {G.count(s, m.id)}/{m.qty}
        </span>
      ))}
    </span>
  );
}

export function Progress({ value, label, color }: { value: number; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div class="progress" role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div class="progress-fill" style={{ width: `${v * 100}%`, background: color }} />
      {label ? <span class="progress-label">{label}</span> : null}
    </div>
  );
}

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span class="stars" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <Sprite key={i} id={i < n ? 'ui_star' : 'ui_star_empty'} scale={0.75} />
      ))}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; badge?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div class="subtabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          class={`subtab ${t.id === value ? 'active' : ''}`}
          data-testid={`subtab-${t.id}`}
          onClick={() => {
            sfx('tap');
            onChange(t.id);
          }}
        >
          {t.label}
          {t.badge ? <span class="badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, children, testid }: { title: string; onClose: () => void; children: ComponentChildren; testid?: string }) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" data-testid={testid} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="close" aria-label="Close" data-testid="sheet-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Panel({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <div class={`panel ${cls ?? ''}`}>{children}</div>;
}

export function Row({ children, class: cls, onClick, testid }: { children: ComponentChildren; class?: string; onClick?: () => void; testid?: string }) {
  return (
    <div class={`row ${cls ?? ''} ${onClick ? 'clickable' : ''}`} onClick={onClick} data-testid={testid}>
      {children}
    </div>
  );
}

export function Timer({ ms }: { ms: number }) {
  return <span class="timer">{G.formatDuration(ms)}</span>;
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="empty">{children}</p>;
}

export function Portrait({ who, scale = 1 }: { who: string; scale?: number }) {
  return <Sprite id={`portrait_${who}`} scale={scale} class="portrait" />;
}
