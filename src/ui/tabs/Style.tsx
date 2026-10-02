// Style tab: avatar, farm decor, animal outfits, and building looks.
import { useState } from 'preact/hooks';
import * as G from '../../core';
import { store } from '../store';
import { nav } from '../nav';
import { useStore } from '../hooks';
import { Btn, Row, Sprite, Tabs, Empty, crisp } from '../components';

const SKIN = ['#F7D7C4', '#F1C7A5', '#E0A982', '#C68A5A', '#9C6A44', '#6E4A32'];
const HAIR = ['#2B1B3D', '#5A3A22', '#7A4A2A', '#B5651D', '#E3C065', '#C9C9C9', '#B48AE0'];
const OUTFIT = ['#7B4FB5', '#B33A3A', '#2E8B57', '#3E64D8', '#FF8A1F', '#FFB7D5', '#37D4D0', '#5A5F73'];

export function StyleTab() {
  useStore();
  const sub = nav.sub.style || 'avatar';
  return (
    <div class="tabpage" data-testid="style-tab">
      <Tabs
        value={sub}
        onChange={(id) => nav.setSub(id)}
        tabs={[
          { id: 'avatar', label: 'Me' },
          { id: 'decor', label: 'Decor' },
          { id: 'animals', label: 'Animals' },
          { id: 'buildings', label: 'Buildings' },
        ]}
      />
      {sub === 'avatar' ? <Avatar /> : sub === 'decor' ? <Decor /> : sub === 'animals' ? <Animals /> : <Buildings />}
    </div>
  );
}

export function AvatarPreview({ scale = 3 }: { scale?: number }) {
  const s = useStore();
  const av = s.avatar;
  const layers: [string, string | undefined][] = [
    ['avatar_body', av.skin],
    [`avatar_${av.outfit}`, av.outfitColor],
    [`avatar_${av.hair}`, av.hairColor],
    [`avatar_${av.hat}`, undefined],
    [`avatar_${av.acc}`, undefined],
  ];
  return (
    <div class="avatar-preview" style={{ width: `${crisp(32, scale)}px`, height: `${crisp(48, scale)}px` }}>
      {layers.map(([id, tint]) => (
        <span key={id} class="layer">
          <Sprite id={id} scale={scale} tint={tint} />
        </span>
      ))}
    </div>
  );
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div class="swatches">
      {colors.map((c) => (
        <button key={c} class={`swatch ${value === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
      ))}
      <input type="color" value={value} onInput={(e) => onPick((e.target as HTMLInputElement).value)} aria-label="Custom color" />
    </div>
  );
}

function Picker({ slot, value, field }: { slot: string; value: string; field: 'hair' | 'outfit' | 'hat' | 'acc' }) {
  const s = useStore();
  const items = s.owned.cosmetics.filter((c) => G.C().cosmetics.get(c)?.slot === slot);
  return (
    <div class="chip-grid">
      {items.map((id) => (
        <button key={id} class={`chip ${value === id ? 'on' : ''}`} onClick={() => store.act((x) => G.setAvatar(x, { [field]: id }))}>
          {G.C().cosmetics.get(id)!.name}
        </button>
      ))}
    </div>
  );
}

function Avatar() {
  const s = useStore();
  const av = s.avatar;
  const set = (patch: Partial<G.GameState['avatar']>) => store.act((x) => G.setAvatar(x, patch));
  return (
    <div>
      <div class="center">
        <AvatarPreview />
        <p>{G.C().personal.playerName}</p>
      </div>
      <h3>Skin tone</h3>
      <Swatches colors={SKIN} value={av.skin} onPick={(c) => set({ skin: c })} />
      <h3>Hair</h3>
      <Picker slot="avatar_hair" value={av.hair} field="hair" />
      <Swatches colors={HAIR} value={av.hairColor} onPick={(c) => set({ hairColor: c })} />
      <h3>Outfit</h3>
      <Picker slot="avatar_outfit" value={av.outfit} field="outfit" />
      <Swatches colors={OUTFIT} value={av.outfitColor} onPick={(c) => set({ outfitColor: c })} />
      <h3>Hat</h3>
      <Picker slot="avatar_hat" value={av.hat} field="hat" />
      <h3>Accessory</h3>
      <Picker slot="avatar_accessory" value={av.acc} field="acc" />
    </div>
  );
}

function Decor() {
  const s = useStore();
  const [layoutName, setLayoutName] = useState('');
  const owned = Object.keys(s.owned.decor).filter((id) => G.C().decor.has(id) && s.owned.decor[id] > 0);
  return (
    <div>
      <p class="small">Decorate the farm on the grid. Tap and hold anything you have placed to move it any time.</p>
      <Btn wide kind="gold" testid="decorate" onClick={() => nav.setEdit({ placing: null, selected: null })}>Decorate the farm</Btn>
      <h3>Your decor</h3>
      {!owned.length ? <Empty>No decor yet. Andrew sells some, and the Season Journal is full of it.</Empty> : null}
      <div class="inv-grid">
        {owned.map((id) => (
          <button key={id} class="inv" onClick={() => nav.setEdit({ placing: G.stashCount(s, id) > 0 ? id : null, selected: null })}>
            <Sprite id={`decor_${id}`} scale={G.C().decor.get(id)!.w > 1 || G.C().decor.get(id)!.h > 1 ? 0.5 : 1} />
            <span class="qty">{G.stashCount(s, id)}/{s.owned.decor[id]}</span>
            <span class="inv-name">{G.C().decor.get(id)!.name}</span>
          </button>
        ))}
      </div>
      <h3>Layouts</h3>
      <div class="btn-row">
        <input class="text" placeholder="Layout name" value={layoutName} maxLength={20} onInput={(e) => setLayoutName((e.target as HTMLInputElement).value)} />
        <Btn small onClick={() => store.act((x) => G.saveLayout(x, layoutName))}>Save</Btn>
      </div>
      {Object.keys(s.layouts).map((name) => (
        <Row key={name}>
          <span class="grow">{name} <span class="small">({s.layouts[name].length} pieces)</span></span>
          <Btn small kind="secondary" onClick={() => {
            const r = store.act((x) => G.loadLayout(x, name));
            if (r.ok && r.msg) store.toast(r.msg);
          }}>Load</Btn>
        </Row>
      ))}
    </div>
  );
}

function Animals() {
  const s = useStore();
  if (!s.animals.length) return <Empty>No animals yet. Fix up the coop and the barn!</Empty>;
  return (
    <div>
      <p class="small">Tap an animal to name it and pick its hat.</p>
      {s.animals.map((a) => (
        <Row key={a.id} onClick={() => nav.openSheet({ kind: 'animal', id: a.id })}>
          <Sprite id={`anim_${a.kind}`} scale={G.C().animals.get(a.kind)?.kind === 'cow' ? 0.75 : 1} />
          <span class="grow">{a.name}</span>
          {a.hat ? <Sprite id={`cos_${a.hat}`} scale={1} /> : <span class="small">no hat</span>}
        </Row>
      ))}
      <Btn kind="ghost" wide onClick={() => nav.setPhoto(true)}>Photo mode</Btn>
    </div>
  );
}

function Buildings() {
  const s = useStore();
  const restored = G.C().raw.buildings.filter((b) => s.buildings[b.id]?.stage === 2 && ['farmhouse', 'barn', 'coop', 'kitchen', 'winery', 'market_stall', 'greenhouse'].includes(b.id));
  const owned = (slot: string) => s.owned.cosmetics.filter((c) => G.C().cosmetics.get(c)?.slot === slot);
  if (!restored.length) return <Empty>Restore a building to paint it.</Empty>;
  return (
    <div>
      {restored.map((b) => {
        const st = s.buildings[b.id];
        const row = (slot: 'paint' | 'roof' | 'skin', cosSlot: string, label: string) => (
          <>
            <p class="small">{label}</p>
            <div class="chip-grid">
              <button class={`chip ${!st[slot] ? 'on' : ''}`} onClick={() => store.act((x) => G.setBuildingStyle(x, b.id, slot, null))}>Original</button>
              {owned(cosSlot).map((c) => (
                <button key={c} class={`chip ${st[slot] === c ? 'on' : ''}`} onClick={() => store.act((x) => G.setBuildingStyle(x, b.id, slot, c))}>
                  <span class="dot" style={{ background: G.C().cosmetics.get(c)!.color }} /> {G.C().cosmetics.get(c)!.name}
                </button>
              ))}
            </div>
          </>
        );
        return (
          <div class="panel" key={b.id}>
            <div class="namecard">
              <Sprite id={`bld_${b.id}_restored`} scale={0.5} />
              <strong class="grow">{b.name}</strong>
            </div>
            {row('paint', 'building_paint', 'Paint')}
            {row('roof', 'building_roof', 'Roof')}
            {row('skin', 'building_skin', 'Trim and seasonal touches')}
          </div>
        );
      })}
    </div>
  );
}

/** Floating toolbar shown on the farm while decorating. */
export function DecorToolbar() {
  const s = useStore();
  const edit = nav.editDecor;
  if (!edit) return null;
  const owned = Object.keys(s.owned.decor).filter((id) => G.C().decor.has(id) && G.stashCount(s, id) > 0);
  const sel = edit.selected ? s.placed.find((p) => p.uid === edit.selected) : null;
  return (
    <div class="decor-toolbar" data-testid="decor-toolbar">
      {sel ? (
        <div class="btn-row">
          <span class="grow">{G.C().decor.get(sel.id)?.name}</span>
          <Btn small kind="secondary" onClick={() => store.act((x) => G.rotateDecor(x, sel.uid))}>Rotate</Btn>
          <Btn small kind="secondary" onClick={() => {
            store.act((x) => G.stashDecor(x, sel.uid));
            nav.setEdit({ placing: null, selected: null });
          }}>Stash</Btn>
        </div>
      ) : (
        <p class="small">{edit.placing ? `Tap a spot to place the ${G.C().decor.get(edit.placing)?.name}.` : 'Pick something from your stash, or drag placed decor to move it.'}</p>
      )}
      <div class="drawer">
        {owned.map((id) => (
          <button key={id} class={`drawer-item ${edit.placing === id ? 'on' : ''}`} onClick={() => nav.setEdit({ placing: id, selected: null })}>
            <Sprite id={`decor_${id}`} scale={G.C().decor.get(id)!.w > 1 || G.C().decor.get(id)!.h > 1 ? 0.5 : 1} />
            <span class="qty">{G.stashCount(s, id)}</span>
          </button>
        ))}
        {!owned.length ? <span class="small">Your stash is empty.</span> : null}
      </div>
      <Btn wide onClick={() => nav.setEdit(null)}>Done</Btn>
    </div>
  );
}
