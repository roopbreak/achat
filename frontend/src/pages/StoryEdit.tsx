import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Nav from '../components/common/Nav'
import BasicInfoTab from '../components/story-edit/BasicInfoTab'
import PromptTab, { type PromptSubTab } from '../components/story-edit/PromptTab'
import LoreBookTab from '../components/story-edit/LoreBookTab'
import ActionBar from '../components/story-edit/ActionBar'
import { useStoryEditForm } from '../hooks/useStoryEditForm'

type MainTab = 'basic' | 'prompt' | 'lore'

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'basic', label: '기본 정보' },
  { key: 'prompt', label: '프롬프트' },
  { key: 'lore', label: '로어북' },
]

export default function StoryEdit() {
  const [params] = useSearchParams()
  const editName = params.get('story')

  const [mainTab, setMainTab] = useState<MainTab>('basic')
  const [promptSubTab, setPromptSubTab] = useState<PromptSubTab>('desc')

  const form = useStoryEditForm(editName)

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 12px' }}>
          <Link to="/admin" style={{ color: 'var(--text-dim)', fontSize: 14 }}>&larr; 관리</Link>
          <h2 style={{ fontSize: 18, margin: 0 }}>{form.ui.isEdit ? `"${editName}" 편집` : '새 스토리 만들기'}</h2>
        </div>

        {/* 메인 탭 바 */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 0, flexShrink: 0 }}>
          {MAIN_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: mainTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: mainTab === t.key ? 'var(--accent)' : 'var(--text-dim)',
                fontSize: 14, fontWeight: mainTab === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {mainTab === 'basic' && <BasicInfoTab {...form.basicInfo} />}
          {mainTab === 'prompt' && <PromptTab {...form.promptFields} subTab={promptSubTab} onSubTabChange={setPromptSubTab} />}
          {mainTab === 'lore' && <LoreBookTab lore={form.loreState.lore} visible={form.loreState.visible} {...form.loreActions} />}
        </div>

        {/* 하단 액션 바 */}
        <ActionBar saving={form.ui.saving} status={form.ui.status} isEdit={form.ui.isEdit} onSave={form.actions.save} onExport={form.actions.exportStory} />
      </div>
    </>
  )
}
