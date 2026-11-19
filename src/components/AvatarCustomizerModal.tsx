import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AVATAR_OPTIONS } from '../game/data';
import { buildChibiAvatar, type ChibiAvatarRig } from '../game/three/avatarBuilder';
import type { AvatarConfig } from '../game/types';

interface AvatarCustomizerModalProps {
  avatar: AvatarConfig;
  isFromTitle: boolean;
  onSave: (next: AvatarConfig, enterTemple: boolean) => void;
  onClose: () => void;
}

type CustomTab = 'face' | 'hair' | 'outfit';

export const AvatarCustomizerModal: React.FC<AvatarCustomizerModalProps> = ({
  avatar,
  isFromTitle,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<AvatarConfig>({ ...avatar });
  const [tab, setTab] = useState<CustomTab>('face');
  const [previewYaw, setPreviewYaw] = useState(0);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<ChibiAvatarRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);

  // Lightweight on-demand 3D Turntable Preview
  useEffect(() => {
    const el = previewMountRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(1);
    const w = el.clientWidth || 260;
    const h = el.clientHeight || 300;
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(36, w / Math.max(1, h), 0.1, 20);
    camera.position.set(0, 1.05, 3.05);
    camera.lookAt(0, 0.78, 0);

    const hemi = new THREE.HemisphereLight(0xfff1dc, 0x5c2618, 0.9);
    const key = new THREE.DirectionalLight(0xffe7c2, 1.35);
    key.position.set(2, 4, 3);
    scene.add(hemi, key);

    // Warm crimson pedestal disc
    const baseGeo = new THREE.CylinderGeometry(0.65, 0.72, 0.1, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x8d1d18, roughness: 0.45 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.05;
    scene.add(baseMesh);

    const renderOnce = () => {
      renderer.render(scene, camera);
    };
    renderOnceRef.current = renderOnce;

    return () => {
      renderOnceRef.current = null;
      if (rigRef.current) {
        scene.remove(rigRef.current.root);
        rigRef.current.dispose();
        rigRef.current = null;
      }
      baseGeo.dispose();
      baseMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild chibi preview when draft or yaw changes (on-demand render!)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      rigRef.current.dispose();
    }
    const rig = buildChibiAvatar(draft, { isPlayer: false, showNameTag: false });
    rig.root.rotation.y = previewYaw;
    scene.add(rig.root);
    rigRef.current = rig;
    renderOnceRef.current?.();
  }, [draft, previewYaw]);

  const randomize = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const funNames = ['想放假的鸚鵡', '佛系信眾', '好運連連喵', '平安喜樂君', '求財小能手', '媽祖好乖孫'];
    setDraft({
      name: draft.name.trim() || pick(funNames),
      skinColor: pick(AVATAR_OPTIONS.skinColors).value,
      eyeStyle: pick(AVATAR_OPTIONS.eyeStyles).id,
      eyebrowStyle: pick(AVATAR_OPTIONS.eyebrowStyles).id,
      mouthStyle: pick(AVATAR_OPTIONS.mouthStyles).id,
      blushColor: pick(AVATAR_OPTIONS.blushColors).value,
      hairStyle: pick(AVATAR_OPTIONS.hairStyles).id,
      hairColor: pick(AVATAR_OPTIONS.hairColors).value,
      outfitStyle: pick(AVATAR_OPTIONS.outfitStyles).id,
      headwear: pick(AVATAR_OPTIONS.headwearStyles).id,
      glasses: pick(AVATAR_OPTIONS.glassesStyles).id,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="自訂分身捏臉換裝"
    >
      <div className="temple-card w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8bd68]/30">
          <div>
            <h2 className="text-xl font-bold text-[#fbe09c] font-temple tracking-wider">
              信眾分身 · 捏臉換裝
            </h2>
            <p className="text-xs text-[#e0c49a]/80 mt-0.5">
              打造專屬 Q 版進香造型，自由搭配五官、髮型與傳統服飾
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={randomize}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#522117] text-[#fbe09c] border border-[#d6a24b]/50 hover:bg-[#6b2b1e] cursor-pointer whitespace-nowrap"
            >
              隨機造型
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉捏臉視窗"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#e8cda2] bg-[#36150f] hover:bg-[#522117] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: 3D Preview Stage */}
          <div className="md:col-span-5 flex flex-col items-center justify-between p-5 bg-[#230e0a] border-b md:border-b-0 md:border-r border-[#e8bd68]/20">
            <div className="w-full">
              <label htmlFor="avatar-name-input" className="block text-xs text-[#e3c28d] mb-1.5">
                信眾暱稱
              </label>
              <input
                id="avatar-name-input"
                type="text"
                maxLength={12}
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="輸入你的信眾暱稱"
                className="w-full px-3.5 py-2 rounded-lg bg-[#160806] border border-[#d4a34d]/45 text-[#fff4de] text-sm focus:outline-none focus:border-[#f5cd75]"
              />
            </div>

            <div
              ref={previewMountRef}
              className="w-full h-[250px] md:h-[300px] relative my-2 rounded-xl overflow-hidden bg-[#1a0a07] border border-[#e8bd68]/20"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewYaw((y) => y - 0.55)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#f6dba2] bg-[#3a1811] border border-[#d6a24b]/40 hover:bg-[#522217] cursor-pointer"
              >
                ↺ 向左轉
              </button>
              <button
                type="button"
                onClick={() => setPreviewYaw(0)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#e8cda2] bg-[#2e130d] border border-[#d6a24b]/30 hover:bg-[#451d14] cursor-pointer"
              >
                正面
              </button>
              <button
                type="button"
                onClick={() => setPreviewYaw((y) => y + 0.55)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#f6dba2] bg-[#3a1811] border border-[#d6a24b]/40 hover:bg-[#522217] cursor-pointer"
              >
                向右轉 ↻
              </button>
            </div>
          </div>

          {/* Right: Customization Tabs & Swatches */}
          <div className="md:col-span-7 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 px-5 pt-4 pb-3 border-b border-[#e8bd68]/20">
              {(
                [
                  ['face', '五官與膚色'],
                  ['hair', '髮型與頭飾'],
                  ['outfit', '服裝與眼鏡'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    tab === id
                      ? 'bg-[#a3221a] text-[#fff2d2] border border-[#f0c56b]/70'
                      : 'bg-[#2a110c] text-[#d6b88e] border border-transparent hover:text-[#fbe09c]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto temple-scroll p-5 space-y-5">
              {tab === 'face' && (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">膚色</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {AVATAR_OPTIONS.skinColors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, skinColor: c.value }))}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${
                            draft.skinColor === c.value
                              ? 'border-[#fde08d] bg-[#5a2217] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/40 inline-block"
                            style={{ backgroundColor: c.value }}
                          />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">眼睛神韻</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {AVATAR_OPTIONS.eyeStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, eyeStyle: item.id }))}
                          className={`py-2 px-2 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                            draft.eyeStyle === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93] hover:bg-[#38160f]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">眉型</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {AVATAR_OPTIONS.eyebrowStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, eyebrowStyle: item.id }))}
                          className={`py-2 px-2 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                            draft.eyebrowStyle === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">嘴型表情</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {AVATAR_OPTIONS.mouthStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, mouthStyle: item.id }))}
                          className={`py-2 px-2 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                            draft.mouthStyle === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">腮紅</h3>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_OPTIONS.blushColors.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, blushColor: item.value }))}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${
                            draft.blushColor === item.value
                              ? 'border-[#fde08d] bg-[#5a2217] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          {item.value !== 'transparent' && (
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block"
                              style={{ backgroundColor: item.value }}
                            />
                          )}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === 'hair' && (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">髮型</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {AVATAR_OPTIONS.hairStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, hairStyle: item.id }))}
                          className={`py-2 px-2 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                            draft.hairStyle === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">髮色</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {AVATAR_OPTIONS.hairColors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, hairColor: c.value }))}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer ${
                            draft.hairColor === c.value
                              ? 'border-[#fde08d] bg-[#5a2217] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                            style={{ backgroundColor: c.value }}
                          />
                          <span className="truncate">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">頭飾配件</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_OPTIONS.headwearStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, headwear: item.id }))}
                          className={`py-2 px-2 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                            draft.headwear === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === 'outfit' && (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">進香服裝</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {AVATAR_OPTIONS.outfitStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, outfitStyle: item.id }))}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs border cursor-pointer ${
                            draft.outfitStyle === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-sm border border-white/40 shrink-0"
                            style={{ backgroundColor: item.primary }}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#e6c48a] mb-2">眼鏡配件</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {AVATAR_OPTIONS.glassesStyles.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, glasses: item.id }))}
                          className={`py-2 px-2 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                            draft.glasses === item.id
                              ? 'border-[#fde08d] bg-[#8f1f18] text-[#fff4dc]'
                              : 'border-[#e8bd68]/25 bg-[#240e0a] text-[#d8bc93]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e8bd68]/25 bg-[#210d09]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#dec094] bg-[#33140e] hover:bg-[#491e16] cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(
                { ...draft, name: draft.name.trim() || '虔誠信眾' },
                isFromTitle,
              )
            }
            className="temple-action-btn px-7 py-2 rounded-lg text-sm font-bold text-[#fff4d4] cursor-pointer"
          >
            {isFromTitle ? '完成造型並入廟參拜' : '套用新造型'}
          </button>
        </div>
      </div>
    </div>
  );
};
