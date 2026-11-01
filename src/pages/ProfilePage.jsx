import { useState } from 'react'
import { useFavorites } from '../hooks/useFavorites'
import About from './About'
import Contact from './Contact'
import { getAllDraftIds, loadDraft } from '../utils/draftStorage'

export default function ProfilePage({ onReplaySplash, onEditProfile, onEditDraft }) {
  const [section, setSection] = useState('about')
  const [profile] = useState(() => JSON.parse(localStorage.getItem('gunshop_profile') || '{"username":"Shooter"}'))
  const { favorites } = useFavorites()
  const drafts = getAllDraftIds().map((id) => ({ id, ...loadDraft(id) }))
  const tabs = ['about', 'contact', 'draft']
  return <div className="profile-page"><section className="masthead"><h1 className="display">Profile</h1><p className="lede">{profile.username} · {favorites.length} favorites · {drafts.length} drafts</p><button className="btn btn--primary" onClick={onEditProfile}>Edit Profile</button> {onReplaySplash && <button className="btn btn--outline" onClick={onReplaySplash}>Replay Intro</button>}</section><nav className="profile-sections">{tabs.map((t)=><button key={t} className={`btn ${section===t?'btn--primary':'btn--outline'}`} onClick={()=>setSection(t)}>{t==='draft'?'Draft':t[0].toUpperCase()+t.slice(1)}</button>)}</nav>{section==='about'&&<About/>}{section==='contact'&&<Contact/>}{section==='draft'&&<section><h2>Draft katalog</h2>{drafts.length===0?<p>Belum ada draft katalog.</p>:<ul className="stock">{drafts.map((d)=><li className="card" key={d.id}><h3>{d.formData?.name||`Draft ${d.id}`}</h3><p>{d.savedAt?new Date(d.savedAt).toLocaleString():''}</p><button className="btn btn--outline" onClick={()=>onEditDraft?.(d.id)}>Lanjutkan draft</button></li>)}</ul>}</section>}</div>
}
