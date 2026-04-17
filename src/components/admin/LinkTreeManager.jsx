import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiLink, FiToggleLeft, FiToggleRight, FiExternalLink, FiChevronUp, FiChevronDown, FiMousePointer, FiGlobe, FiInstagram, FiYoutube, FiTwitter, FiLinkedin, FiMail, FiPhone, FiBookOpen, FiVideo, FiAward, FiZap, FiMessageCircle, FiBriefcase, FiMap, FiFileText, FiHeart, FiStar, FiUsers, FiHome, FiShoppingCart, FiShoppingBag, FiCalendar, FiCamera, FiMusic, FiHeadphones, FiMic, FiTv, FiCpu, FiCode, FiTerminal, FiDatabase, FiCloud, FiLock, FiUnlock, FiDownload, FiUpload, FiShare2, FiGift, FiDollarSign, FiCreditCard, FiTruck, FiMapPin, FiNavigation, FiCompass, FiSun, FiMoon, FiDroplet, FiWifi, FiRss, FiRadio, FiCast, FiPrinter, FiClipboard, FiBookmark, FiFlag, FiTrendingUp, FiBarChart2, FiPieChart, FiActivity, FiTarget, FiAnchor, FiFeather, FiPenTool, FiScissors, FiTool, FiSettings, FiGrid, FiLayout, FiSidebar, FiImage, FiFilm, FiSliders, FiLayers, FiPackage, FiBox, FiArchive, FiFolder, FiHardDrive, FiMonitor, FiSmartphone, FiTablet, FiWatch, FiSpeaker, FiBell, FiInfo, FiHelpCircle, FiAlertCircle, FiCheckCircle, FiThumbsUp, FiSmile, FiCoffee, FiSend, FiLifeBuoy, FiCommand, FiHash, FiAtSign, FiPercent, FiUser, FiUserPlus, FiShield } from 'react-icons/fi';
import { FaWhatsapp, FaTelegram, FaDiscord, FaFacebook, FaTwitter, FaLinkedinIn, FaPinterest, FaReddit, FaSnapchat, FaTiktok, FaSpotify, FaAmazon, FaApple, FaGoogle, FaMicrosoft, FaGithub, FaGitlab, FaStackOverflow, FaDribbble, FaBehance, FaFigma, FaMedium, FaWordpress, FaShopify, FaPaypal, FaStripe, FaBitcoin, FaEthereum, FaNpm, FaDocker, FaAws, FaSlack, FaSkype, FaViber, FaLine, FaThreads, FaXTwitter } from 'react-icons/fa6';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../context/AlertContext';
import Modal from '../ui/Modal';

// Available icons for selection — grouped by category
const ICON_OPTIONS = [
  // ── Social Media ──
  { name: 'FiInstagram', label: 'Instagram', Icon: FiInstagram },
  { name: 'FiYoutube', label: 'YouTube', Icon: FiYoutube },
  { name: 'FiTwitter', label: 'Twitter', Icon: FiTwitter },
  { name: 'FaXTwitter', label: 'X (Twitter)', Icon: FaXTwitter },
  { name: 'FiLinkedin', label: 'LinkedIn', Icon: FiLinkedin },
  { name: 'FaLinkedinIn', label: 'LinkedIn Alt', Icon: FaLinkedinIn },
  { name: 'FaWhatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
  { name: 'FaTelegram', label: 'Telegram', Icon: FaTelegram },
  { name: 'FaDiscord', label: 'Discord', Icon: FaDiscord },
  { name: 'FaFacebook', label: 'Facebook', Icon: FaFacebook },
  { name: 'FaPinterest', label: 'Pinterest', Icon: FaPinterest },
  { name: 'FaReddit', label: 'Reddit', Icon: FaReddit },
  { name: 'FaSnapchat', label: 'Snapchat', Icon: FaSnapchat },
  { name: 'FaTiktok', label: 'TikTok', Icon: FaTiktok },
  { name: 'FaThreads', label: 'Threads', Icon: FaThreads },
  { name: 'FaSlack', label: 'Slack', Icon: FaSlack },
  { name: 'FaSkype', label: 'Skype', Icon: FaSkype },
  { name: 'FaViber', label: 'Viber', Icon: FaViber },
  { name: 'FaLine', label: 'Line', Icon: FaLine },

  // ── Communication ──
  { name: 'FiMail', label: 'Email', Icon: FiMail },
  { name: 'FiPhone', label: 'Phone', Icon: FiPhone },
  { name: 'FiMessageCircle', label: 'Chat', Icon: FiMessageCircle },
  { name: 'FiSend', label: 'Send', Icon: FiSend },
  { name: 'FiAtSign', label: 'At Sign', Icon: FiAtSign },

  // ── General Links ──
  { name: 'FiExternalLink', label: 'External Link', Icon: FiExternalLink },
  { name: 'FiGlobe', label: 'Website', Icon: FiGlobe },
  { name: 'FiLink', label: 'Chain Link', Icon: FiLink },
  { name: 'FiHome', label: 'Home', Icon: FiHome },
  { name: 'FiShare2', label: 'Share', Icon: FiShare2 },
  { name: 'FiRss', label: 'RSS Feed', Icon: FiRss },

  // ── Education & Learning ──
  { name: 'FiBookOpen', label: 'Courses', Icon: FiBookOpen },
  { name: 'FiVideo', label: 'Video', Icon: FiVideo },
  { name: 'FiAward', label: 'Certificate', Icon: FiAward },
  { name: 'FiZap', label: 'Quiz', Icon: FiZap },
  { name: 'FiBookmark', label: 'Bookmark', Icon: FiBookmark },
  { name: 'FiClipboard', label: 'Notes', Icon: FiClipboard },
  { name: 'FiFileText', label: 'Document', Icon: FiFileText },

  // ── Business & Commerce ──
  { name: 'FiBriefcase', label: 'Jobs', Icon: FiBriefcase },
  { name: 'FiShoppingCart', label: 'Cart', Icon: FiShoppingCart },
  { name: 'FiShoppingBag', label: 'Shop', Icon: FiShoppingBag },
  { name: 'FiDollarSign', label: 'Payment', Icon: FiDollarSign },
  { name: 'FiCreditCard', label: 'Card', Icon: FiCreditCard },
  { name: 'FiGift', label: 'Gift', Icon: FiGift },
  { name: 'FiTruck', label: 'Delivery', Icon: FiTruck },
  { name: 'FaPaypal', label: 'PayPal', Icon: FaPaypal },
  { name: 'FaShopify', label: 'Shopify', Icon: FaShopify },

  // ── Media & Entertainment ──
  { name: 'FiCamera', label: 'Camera', Icon: FiCamera },
  { name: 'FiImage', label: 'Image', Icon: FiImage },
  { name: 'FiFilm', label: 'Film', Icon: FiFilm },
  { name: 'FiMusic', label: 'Music', Icon: FiMusic },
  { name: 'FiHeadphones', label: 'Podcast', Icon: FiHeadphones },
  { name: 'FiMic', label: 'Mic', Icon: FiMic },
  { name: 'FiTv', label: 'TV', Icon: FiTv },
  { name: 'FiRadio', label: 'Radio', Icon: FiRadio },
  { name: 'FiCast', label: 'Cast', Icon: FiCast },
  { name: 'FaSpotify', label: 'Spotify', Icon: FaSpotify },

  // ── Tech & Dev ──
  { name: 'FiCode', label: 'Code', Icon: FiCode },
  { name: 'FiTerminal', label: 'Terminal', Icon: FiTerminal },
  { name: 'FiCpu', label: 'CPU', Icon: FiCpu },
  { name: 'FiDatabase', label: 'Database', Icon: FiDatabase },
  { name: 'FiCloud', label: 'Cloud', Icon: FiCloud },
  { name: 'FaGithub', label: 'GitHub', Icon: FaGithub },
  { name: 'FaGitlab', label: 'GitLab', Icon: FaGitlab },
  { name: 'FaStackOverflow', label: 'Stack Overflow', Icon: FaStackOverflow },
  { name: 'FaNpm', label: 'NPM', Icon: FaNpm },
  { name: 'FaDocker', label: 'Docker', Icon: FaDocker },
  { name: 'FaAws', label: 'AWS', Icon: FaAws },

  // ── Design ──
  { name: 'FaDribbble', label: 'Dribbble', Icon: FaDribbble },
  { name: 'FaBehance', label: 'Behance', Icon: FaBehance },
  { name: 'FaFigma', label: 'Figma', Icon: FaFigma },
  { name: 'FiPenTool', label: 'Design', Icon: FiPenTool },
  { name: 'FiFeather', label: 'Feather', Icon: FiFeather },
  { name: 'FiLayers', label: 'Layers', Icon: FiLayers },
  { name: 'FiLayout', label: 'Layout', Icon: FiLayout },
  { name: 'FiGrid', label: 'Grid', Icon: FiGrid },
  { name: 'FiSliders', label: 'Sliders', Icon: FiSliders },

  // ── Blog & Content ──
  { name: 'FaMedium', label: 'Medium', Icon: FaMedium },
  { name: 'FaWordpress', label: 'WordPress', Icon: FaWordpress },
  { name: 'FiHash', label: 'Hashtag', Icon: FiHash },

  // ── Brands ──
  { name: 'FaGoogle', label: 'Google', Icon: FaGoogle },
  { name: 'FaApple', label: 'Apple', Icon: FaApple },
  { name: 'FaMicrosoft', label: 'Microsoft', Icon: FaMicrosoft },
  { name: 'FaAmazon', label: 'Amazon', Icon: FaAmazon },

  // ── Location & Navigation ──
  { name: 'FiMap', label: 'Map', Icon: FiMap },
  { name: 'FiMapPin', label: 'Location', Icon: FiMapPin },
  { name: 'FiNavigation', label: 'Navigate', Icon: FiNavigation },
  { name: 'FiCompass', label: 'Compass', Icon: FiCompass },

  // ── Analytics & Growth ──
  { name: 'FiTrendingUp', label: 'Trending', Icon: FiTrendingUp },
  { name: 'FiBarChart2', label: 'Bar Chart', Icon: FiBarChart2 },
  { name: 'FiPieChart', label: 'Pie Chart', Icon: FiPieChart },
  { name: 'FiActivity', label: 'Activity', Icon: FiActivity },
  { name: 'FiTarget', label: 'Target', Icon: FiTarget },

  // ── People & Community ──
  { name: 'FiUsers', label: 'Community', Icon: FiUsers },
  { name: 'FiUser', label: 'Profile', Icon: FiUser },
  { name: 'FiUserPlus', label: 'Add User', Icon: FiUserPlus },
  { name: 'FiShield', label: 'Shield', Icon: FiShield },

  // ── Utility & Misc ──
  { name: 'FiCalendar', label: 'Calendar', Icon: FiCalendar },
  { name: 'FiDownload', label: 'Download', Icon: FiDownload },
  { name: 'FiUpload', label: 'Upload', Icon: FiUpload },
  { name: 'FiLock', label: 'Lock', Icon: FiLock },
  { name: 'FiSettings', label: 'Settings', Icon: FiSettings },
  { name: 'FiTool', label: 'Tool', Icon: FiTool },
  { name: 'FiPackage', label: 'Package', Icon: FiPackage },
  { name: 'FiFolder', label: 'Folder', Icon: FiFolder },
  { name: 'FiPrinter', label: 'Print', Icon: FiPrinter },
  { name: 'FiBell', label: 'Bell', Icon: FiBell },
  { name: 'FiFlag', label: 'Flag', Icon: FiFlag },
  { name: 'FiInfo', label: 'Info', Icon: FiInfo },
  { name: 'FiHelpCircle', label: 'Help', Icon: FiHelpCircle },
  { name: 'FiLifeBuoy', label: 'Support', Icon: FiLifeBuoy },

  // ── Reactions ──
  { name: 'FiHeart', label: 'Heart', Icon: FiHeart },
  { name: 'FiStar', label: 'Star', Icon: FiStar },
  { name: 'FiThumbsUp', label: 'Like', Icon: FiThumbsUp },
  { name: 'FiSmile', label: 'Smile', Icon: FiSmile },
  { name: 'FiCoffee', label: 'Coffee', Icon: FiCoffee },

  // ── Devices ──
  { name: 'FiMonitor', label: 'Desktop', Icon: FiMonitor },
  { name: 'FiSmartphone', label: 'Mobile', Icon: FiSmartphone },
  { name: 'FiTablet', label: 'Tablet', Icon: FiTablet },
  { name: 'FiWatch', label: 'Watch', Icon: FiWatch },
  { name: 'FiSpeaker', label: 'Speaker', Icon: FiSpeaker },

  // ── Nature ──
  { name: 'FiSun', label: 'Sun', Icon: FiSun },
  { name: 'FiMoon', label: 'Moon', Icon: FiMoon },
  { name: 'FiDroplet', label: 'Droplet', Icon: FiDroplet },
  { name: 'FiAnchor', label: 'Anchor', Icon: FiAnchor },
  { name: 'FiWifi', label: 'WiFi', Icon: FiWifi },

  // ── Crypto ──
  { name: 'FaBitcoin', label: 'Bitcoin', Icon: FaBitcoin },
  { name: 'FaEthereum', label: 'Ethereum', Icon: FaEthereum },
  { name: 'FiPercent', label: 'Percent', Icon: FiPercent },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.name, o.Icon]));

export default function LinkTreeManager() {
  const { showAlert, showConfirm } = useAlert();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', url: '', icon_name: 'FiExternalLink' });
  const [saving, setSaving] = useState(false);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('link_tree')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      setLinks(data || []);
    } catch (err) {
      showAlert('Error loading links: ' + err.message, 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', url: '', icon_name: 'FiExternalLink' });
    setShowModal(true);
  };

  const openEdit = (link) => {
    setEditing(link);
    setForm({ title: link.title, url: link.url, icon_name: link.icon_name || 'FiExternalLink' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('link_tree')
          .update({ title: form.title, url: form.url, icon_name: form.icon_name })
          .eq('id', editing.id);
        if (error) throw error;
        setLinks(links.map(l => l.id === editing.id ? { ...l, ...form } : l));
        showAlert('Link updated.', 'Success', 'success');
      } else {
        const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order_index)) + 1 : 0;
        const { data, error } = await supabase
          .from('link_tree')
          .insert([{ ...form, order_index: maxOrder }])
          .select()
          .single();
        if (error) throw error;
        setLinks([...links, data]);
        showAlert('Link added.', 'Success', 'success');
      }
      setShowModal(false);
    } catch (err) {
      showAlert('Error saving link: ' + err.message, 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Delete this link?', undefined, 'Delete Link', 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('link_tree').delete().eq('id', id);
      if (error) throw error;
      setLinks(links.filter(l => l.id !== id));
    } catch (err) {
      showAlert('Error deleting: ' + err.message, 'Error', 'error');
    }
  };

  const handleToggle = async (link) => {
    try {
      const { error } = await supabase
        .from('link_tree')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);
      if (error) throw error;
      setLinks(links.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l));
    } catch (err) {
      showAlert('Error toggling: ' + err.message, 'Error', 'error');
    }
  };

  // ─── Reorder: move up/down ───
  const moveLink = async (index, direction) => {
    const newLinks = [...links];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newLinks.length) return;

    // Swap order_index values
    const tempOrder = newLinks[index].order_index;
    newLinks[index].order_index = newLinks[swapIndex].order_index;
    newLinks[swapIndex].order_index = tempOrder;

    // Swap positions in array
    [newLinks[index], newLinks[swapIndex]] = [newLinks[swapIndex], newLinks[index]];
    setLinks(newLinks);

    // Persist both changes
    try {
      await Promise.all([
        supabase.from('link_tree').update({ order_index: newLinks[index].order_index }).eq('id', newLinks[index].id),
        supabase.from('link_tree').update({ order_index: newLinks[swapIndex].order_index }).eq('id', newLinks[swapIndex].id),
      ]);
    } catch (err) {
      console.error('Error persisting order:', err);
    }
  };

  // ─── Drag and drop ───
  const handleDragStart = (index) => { dragItem.current = index; };
  const handleDragEnter = (index) => { dragOver.current = index; };
  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    const newLinks = [...links];
    const draggedItem = newLinks.splice(dragItem.current, 1)[0];
    newLinks.splice(dragOver.current, 0, draggedItem);

    // Reassign order_index
    const updated = newLinks.map((l, i) => ({ ...l, order_index: i }));
    setLinks(updated);
    dragItem.current = null;
    dragOver.current = null;

    // Persist all order changes
    try {
      await Promise.all(
        updated.map(l => supabase.from('link_tree').update({ order_index: l.order_index }).eq('id', l.id))
      );
    } catch (err) {
      console.error('Error persisting drag order:', err);
    }
  };

  const getIcon = (name) => {
    const Comp = ICON_MAP[name] || FiExternalLink;
    return <Comp />;
  };

  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);

  return (
    <div className="ap-content animate-fade">
      <div className="ap-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2><FiLink style={{ marginRight: 8, color: 'var(--primary)' }} /> Link Tree</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Manage your public link tree page at <a href="/links" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>/links</a></p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FiPlus /> Add Link
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#008ad1', borderRadius: 10, padding: 10, color: '#fff', display: 'flex' }}><FiLink size={20} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Links</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c4a6e' }}>{links.length}</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#10b981', borderRadius: 10, padding: 10, color: '#fff', display: 'flex' }}><FiMousePointer size={20} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Clicks</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d' }}>{totalClicks.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#f59e0b', borderRadius: 10, padding: 10, color: '#fff', display: 'flex' }}><FiToggleRight size={20} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Links</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#78350f' }}>{links.filter(l => l.is_active).length}</div>
          </div>
        </div>
      </div>

      {/* Links Table */}
      <div className="ap-table-wrap">
        <table className="id-table ap-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Order</th>
              <th>Link</th>
              <th style={{ width: 90 }}>Clicks</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>Loading links...</td></tr>
            ) : links.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>No links yet. Add your first link!</td></tr>
            ) : (
              links.map((link, idx) => (
                <tr
                  key={link.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{ cursor: 'grab', opacity: link.is_active ? 1 : 0.5 }}
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px', minWidth: 0 }}
                        onClick={() => moveLink(idx, -1)}
                        disabled={idx === 0}
                      ><FiChevronUp size={14} /></button>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)' }}>{idx + 1}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px', minWidth: 0 }}
                        onClick={() => moveLink(idx, 1)}
                        disabled={idx === links.length - 1}
                      ><FiChevronDown size={14} /></button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#008ad1', fontSize: '1.1rem', flexShrink: 0
                      }}>
                        {getIcon(link.icon_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--dark)' }}>{link.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FiMousePointer size={13} style={{ color: 'var(--gray-400)' }} />
                      <span style={{ fontWeight: 700 }}>{link.clicks || 0}</span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggle(link)}
                      style={{ color: link.is_active ? '#10b981' : '#9ca3af', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {link.is_active ? <><FiToggleRight size={18} /> Active</> : <><FiToggleLeft size={18} /> Off</>}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(link)} title="Edit"><FiEdit2 size={14} /></button>
                      <button className="btn btn-outline btn-sm" onClick={() => window.open(link.url, '_blank')} title="Open"><FiExternalLink size={14} /></button>
                      <button className="btn btn-outline btn-sm danger" onClick={() => handleDelete(link.id)} title="Delete"><FiTrash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Link' : 'Add New Link'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Our Website"
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: '0.938rem' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: '0.938rem' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ICON_OPTIONS.map(opt => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => setForm({ ...form, icon_name: opt.name })}
                  title={opt.label}
                  style={{
                    width: 42, height: 42, borderRadius: 8, border: form.icon_name === opt.name ? '2px solid #008ad1' : '1px solid var(--gray-200)',
                    background: form.icon_name === opt.name ? '#e0f2fe' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: form.icon_name === opt.name ? '#008ad1' : 'var(--gray-500)',
                    cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.15s ease'
                  }}
                >
                  <opt.Icon />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
