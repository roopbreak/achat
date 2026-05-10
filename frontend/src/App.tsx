import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Chat from './pages/Chat'
import Admin from './pages/Admin'
import Story from './pages/Story'
import StoryEdit from './pages/StoryEdit'
import History from './pages/History'
import Login from './pages/Login'
import Gallery from './pages/Gallery'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chat/:storyName" element={<Chat />} />
      <Route path="/story" element={<Story />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/story-edit" element={<StoryEdit />} />
      <Route path="/history" element={<History />} />
      <Route path="/login" element={<Login />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/gallery/:storyName" element={<Gallery />} />
    </Routes>
  )
}
