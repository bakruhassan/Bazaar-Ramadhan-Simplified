import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Star, 
  Navigation, 
  Bus, 
  MessageSquare,
  Loader2,
  ChevronRight,
  X,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Moon,
  Sun,
  Clock,
  Info,
  Bell,
  User,
  LogOut,
  Mail,
  Lock
} from 'lucide-react';
import { searchPlaces, getReviews, addReview, getVotes, submitVote, login, signup, getMe, subscribe, getNotifications, markNotificationsRead } from './services/api';
import { Place, Review, OFFICIAL_BAZAARS } from './types';
import AuthModal from './components/AuthModal';
import NotificationsPopover from './components/NotificationsPopover';

// Custom Mosque icon
const MosqueIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 2L12 7" />
    <path d="M12 12C12 12 12 12 12 12C12 12 12 12 12 12Z" />
    <path d="M2 22H22" />
    <path d="M4 22V12C4 12 7 7 12 7C17 7 20 12 20 12V22" />
    <path d="M9 22V17C9 15.3431 10.3431 14 12 14C13.6569 14 15 15.3431 15 17V22" />
  </svg>
);

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bazaars, setBazaars] = useState<Place[]>([]);
  const [mosques, setMosques] = useState<Place[]>([]);
  const [transports, setTransports] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ user_name: '', rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('favorites') || '[]'));
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>({});
  
  // Auth & Notifications State
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Fingerprint for voting (simple)
  const fingerprint = useMemo(() => {
    let fp = localStorage.getItem('user_fp');
    if (!fp) {
      fp = Math.random().toString(36).substring(2);
      localStorage.setItem('user_fp', fp);
    }
    return fp;
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Check Auth on Mount
  useEffect(() => {
    const checkAuth = async () => {
      const userData = await getMe();
      if (userData) {
        setUser(userData);
        fetchNotifications();
      }
    };
    checkAuth();
  }, []);

  const fetchNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setShowProfile(false);
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
    
    // Load official bazaars initially
    const initialBazaars: Place[] = OFFICIAL_BAZAARS.map((b, i) => ({
      id: `official-${i}`,
      name: `Bazaar Ramadhan ${b.location}`,
      address: b.address,
      council: b.council,
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address + " " + b.location)}`,
      type: 'bazaar'
    }));
    setBazaars(initialBazaars);
    
    // Fetch votes for all initial bazaars
    initialBazaars.forEach(async (b) => {
      const v = await getVotes(b.name);
      setVotes(prev => ({ ...prev, [b.name]: v }));
    });
  }, []);

  const handleSearch = async () => {
    if (!location) {
      alert("Please allow location access to find nearest bazaars.");
      return;
    }
    setLoading(true);
    try {
      const [bazaarResults, mosqueResults, transportResults] = await Promise.all([
        searchPlaces("Bazaar Ramadhan", location.lat, location.lng),
        searchPlaces("Mosque", location.lat, location.lng),
        searchPlaces("Public Transport Station", location.lat, location.lng)
      ]);
      
      // Merge official with search results, avoiding duplicates
      const mergedBazaars = [...bazaars];
      bazaarResults.forEach(res => {
        if (!mergedBazaars.some(b => b.name === res.name)) {
          mergedBazaars.push(res);
        }
      });

      setBazaars(mergedBazaars);
      setMosques(mosqueResults);
      setTransports(transportResults);

      // Fetch votes for new results
      mergedBazaars.forEach(async (b) => {
        if (!votes[b.name]) {
          const v = await getVotes(b.name);
          setVotes(prev => ({ ...prev, [b.name]: v }));
        }
      });
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (e: React.MouseEvent, placeName: string) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(placeName) 
        ? prev.filter(f => f !== placeName) 
        : [...prev, placeName]
    );
  };

  const handleVote = async (e: React.MouseEvent, placeName: string, type: number) => {
    e.stopPropagation();
    await submitVote(placeName, type, fingerprint);
    const v = await getVotes(placeName);
    setVotes(prev => ({ ...prev, [placeName]: v }));
  };

  const openPlaceDetails = async (place: Place) => {
    setSelectedPlace(place);
    setLoading(true);
    try {
      const [placeReviews, transportNearby] = await Promise.all([
        getReviews(place.name),
        searchPlaces(`Public transport near ${place.address || place.name}`, location?.lat, location?.lng)
      ]);
      setReviews(placeReviews);
      if (transportNearby.length > 0) {
        setTransports(transportNearby);
      }
    } catch (error) {
      console.error("Failed to load details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (selectedPlace) {
      await subscribe(selectedPlace.name);
      // Ideally show a toast, but alert is fine for now
      alert(`Subscribed to updates for ${selectedPlace.name}`);
    }
  };

  const handleMarkRead = async () => {
    await markNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) return;
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setSubmittingReview(true);
    try {
      await addReview({
        place_id: selectedPlace.name,
        rating: newReview.rating,
        comment: newReview.comment
      });
      const updatedReviews = await getReviews(selectedPlace.name);
      setReviews(updatedReviews);
      setNewReview({ user_name: '', rating: 5, comment: '' });
    } catch (error) {
      console.error("Failed to add review:", error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredBazaars = useMemo(() => {
    if (activeTab === 'favorites') {
      return bazaars.filter(b => favorites.includes(b.name));
    }
    return bazaars;
  }, [bazaars, favorites, activeTab]);

  return (
    <div className="min-h-screen pb-12 transition-colors duration-500 dark:bg-stone-950 dark:text-stone-100 selection:bg-ramadhan-gold/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-white/40 dark:bg-stone-900/40 backdrop-blur-2xl border-b border-stone-200/50 dark:border-stone-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('all')}
          >
            <div className="w-10 h-10 bg-ramadhan-olive dark:bg-ramadhan-gold rounded-2xl flex items-center justify-center text-white dark:text-ramadhan-olive shadow-lg shadow-ramadhan-olive/20 dark:shadow-ramadhan-gold/20 group-hover:rotate-12 transition-transform">
              <MapPin size={20} />
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight">Bazaar<span className="text-ramadhan-gold italic">Ramadhan</span></span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 mr-4">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                  activeTab === 'all' 
                  ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xl' 
                  : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                Explore
              </button>
              <button 
                onClick={() => setActiveTab('favorites')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                  activeTab === 'favorites' 
                  ? 'bg-red-500 text-white shadow-xl shadow-red-500/20' 
                  : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Heart size={18} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">Saved</span>
              </button>
            </div>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-500 dark:text-stone-400"
              title="Toggle Theme"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <div className="w-px h-6 bg-stone-200 dark:bg-stone-800 mx-2" />
            
            {user ? (
              <>
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-3 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-500 dark:text-stone-400 relative"
                  >
                    <Bell size={20} />
                    {notifications.some(n => !n.is_read) && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-stone-900" />
                    )}
                  </button>
                  <NotificationsPopover 
                    isOpen={showNotifications}
                    notifications={notifications}
                    onClose={() => setShowNotifications(false)}
                    onMarkRead={handleMarkRead}
                  />
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowProfile(!showProfile)}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-ramadhan-gold text-white flex items-center justify-center text-xs font-bold">
                      {user.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-bold hidden sm:inline">{user.username}</span>
                  </button>
                  
                  <AnimatePresence>
                    {showProfile && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-14 right-0 w-48 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-100 dark:border-stone-800 overflow-hidden z-50"
                      >
                        <div className="p-4 border-b border-stone-100 dark:border-stone-800">
                          <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-1">Signed in as</p>
                          <p className="text-sm font-medium truncate">{user.email}</p>
                        </div>
                        <button 
                          onClick={handleLogout}
                          className="w-full p-4 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"
                        >
                          <LogOut size={16} />
                          Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-2.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl text-sm font-bold hover:scale-105 transition-transform shadow-lg shadow-stone-900/10 dark:shadow-white/5"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(userData) => {
          setUser(userData);
          fetchNotifications();
        }} 
      />

      <AnimatePresence mode="wait">
        {activeTab === 'all' ? (
          <motion.div
            key="explore"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Hero Section */}
            <header className="relative pt-48 pb-24 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ramadhan-cream dark:to-stone-950 z-10" />
                <img 
                  src="https://picsum.photos/seed/ramadhan-minimal/1920/1080?blur=10" 
                  alt="Ramadhan Background" 
                  className="w-full h-full object-cover opacity-20 dark:opacity-10"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="relative z-20 text-center px-6 max-w-5xl">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ramadhan-gold/10 text-ramadhan-gold text-xs font-black uppercase tracking-[0.2em] mb-8"
                >
                  <Clock size={14} />
                  Ramadhan 2026 • Live Directory
                </motion.div>
                <h1 className="text-7xl md:text-9xl font-serif mb-8 tracking-tighter leading-[0.9]">
                  Find your <br />
                  <span className="text-ramadhan-gold italic">perfect</span> Iftar.
                </h1>
                <p className="text-xl md:text-2xl text-stone-500 dark:text-stone-400 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
                  The most accurate guide to Bazaar Ramadhan in Malaysia, powered by official council data and real-time transit info.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSearch}
                    disabled={loading}
                    className="group px-12 py-5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-black rounded-3xl shadow-2xl shadow-stone-900/20 dark:shadow-white/10 flex items-center gap-4 disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Search size={24} className="group-hover:rotate-12 transition-transform" />}
                    {loading ? "Locating..." : "Find Bazaars Near Me"}
                  </motion.button>
                </div>
                <div className="mt-12 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                  {['MPKj', 'DBKL', 'MBSA', 'MBSJ', 'MBPJ', 'PPj'].map(c => (
                    <span key={c} className="text-sm font-black tracking-widest">{c}</span>
                  ))}
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 mt-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                {/* Bazaars List */}
                <section className="lg:col-span-8 space-y-12">
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-8">
                    <h2 className="text-5xl font-serif tracking-tight">Directory</h2>
                    <div className="flex items-center gap-3 px-4 py-2 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Official Data</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredBazaars.map((bazaar) => (
                      <motion.div
                        key={bazaar.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => openPlaceDetails(bazaar)}
                        className="group bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-3xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-ramadhan-olive/5 dark:bg-ramadhan-gold/5 rounded-bl-[6rem] -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                        
                        <div className="flex justify-between items-start mb-8 relative z-10">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-ramadhan-gold mb-2">
                              {bazaar.council || "Verified"}
                            </span>
                            <h3 className="text-3xl font-serif leading-[1.1] group-hover:text-ramadhan-gold transition-colors">{bazaar.name}</h3>
                          </div>
                          <button 
                            onClick={(e) => toggleFavorite(e, bazaar.name)}
                            className={`p-4 rounded-2xl transition-all ${
                              favorites.includes(bazaar.name) 
                              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                              : 'bg-stone-50 text-stone-300 dark:bg-stone-800 hover:text-red-400'
                            }`}
                          >
                            <Heart size={22} fill={favorites.includes(bazaar.name) ? 'currentColor' : 'none'} />
                          </button>
                        </div>

                        <p className="text-stone-500 dark:text-stone-400 text-base mb-10 line-clamp-2 font-light leading-relaxed">
                          {bazaar.address}
                        </p>

                        <div className="flex items-center justify-between relative z-10 pt-6 border-t border-stone-50 dark:border-stone-800">
                          <div className="flex items-center gap-6">
                            <button 
                              onClick={(e) => handleVote(e, bazaar.name, 1)}
                              className="flex items-center gap-2 text-stone-400 hover:text-green-500 transition-all hover:scale-110"
                            >
                              <ThumbsUp size={20} />
                              <span className="text-sm font-black">{votes[bazaar.name]?.up || 0}</span>
                            </button>
                            <button 
                              onClick={(e) => handleVote(e, bazaar.name, -1)}
                              className="flex items-center gap-2 text-stone-400 hover:text-red-500 transition-all hover:scale-110"
                            >
                              <ThumbsDown size={20} />
                              <span className="text-sm font-black">{votes[bazaar.name]?.down || 0}</span>
                            </button>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center group-hover:bg-ramadhan-gold group-hover:text-white transition-all">
                            <ChevronRight size={20} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* Sidebar */}
                <aside className="lg:col-span-4 space-y-16">
                  <section className="p-10 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-[3rem] shadow-2xl shadow-stone-900/20">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-white/10 dark:bg-stone-900/10 rounded-2xl">
                        <Bus size={24} />
                      </div>
                      <h2 className="text-3xl font-serif">Transit</h2>
                    </div>
                    <div className="space-y-6">
                      <div className="p-6 bg-white/5 dark:bg-stone-900/5 rounded-3xl border border-white/10 dark:border-stone-900/10">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock size={16} className="text-ramadhan-gold" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Peak Traffic</span>
                        </div>
                        <p className="text-lg font-medium">4:30 PM — 6:45 PM</p>
                      </div>
                      <div className="p-6 bg-white/5 dark:bg-stone-900/5 rounded-3xl border border-white/10 dark:border-stone-900/10">
                        <div className="flex items-center gap-3 mb-2">
                          <Info size={16} className="text-ramadhan-gold" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Smart Travel</span>
                        </div>
                        <p className="text-sm font-light leading-relaxed opacity-80">
                          LRT and MRT stations are usually within 10-15 mins walk from major bazaars. Check live arrival times in Maps.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-3xl font-serif mb-8 flex items-center gap-3">
                      <MosqueIcon className="w-7 h-7 text-ramadhan-gold" />
                      Prayer
                    </h2>
                    <div className="space-y-4">
                      {mosques.map(mosque => (
                        <a 
                          key={mosque.id}
                          href={mosque.mapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 hover:border-ramadhan-gold transition-all group"
                        >
                          <span className="font-medium text-stone-800 dark:text-stone-200">{mosque.name}</span>
                          <Navigation size={18} className="text-stone-300 group-hover:text-ramadhan-gold group-hover:translate-x-1 transition-all" />
                        </a>
                      ))}
                      {mosques.length === 0 && <p className="text-sm text-stone-400 italic font-light px-4">Search to find nearby mosques.</p>}
                    </div>
                  </section>

                  <section>
                    <h2 className="text-3xl font-serif mb-8 flex items-center gap-3">
                      <Bus className="text-ramadhan-gold" />
                      Transit
                    </h2>
                    <div className="space-y-4">
                      {transports.map(station => (
                        <a 
                          key={station.id}
                          href={station.mapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 hover:border-ramadhan-gold transition-all group"
                        >
                          <span className="font-medium text-stone-800 dark:text-stone-200">{station.name}</span>
                          <Navigation size={18} className="text-stone-300 group-hover:text-ramadhan-gold group-hover:translate-x-1 transition-all" />
                        </a>
                      ))}
                      {transports.length === 0 && <p className="text-sm text-stone-400 italic font-light px-4">Search to find nearby transport.</p>}
                    </div>
                  </section>
                </aside>
              </div>
            </main>
          </motion.div>
        ) : (
          <motion.div
            key="favorites"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="pt-40 max-w-7xl mx-auto px-6"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div>
                <h2 className="text-7xl md:text-9xl font-serif tracking-tighter mb-4">Saved <span className="text-red-500 italic">Spots</span></h2>
                <p className="text-xl text-stone-500 dark:text-stone-400 font-light max-w-xl">
                  Your curated list of must-visit bazaars for this Ramadhan.
                </p>
              </div>
              <div className="px-8 py-4 bg-stone-50 dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800">
                <span className="text-4xl font-serif text-ramadhan-gold">{filteredBazaars.length}</span>
                <span className="text-xs font-black uppercase tracking-widest text-stone-400 ml-4">Locations Saved</span>
              </div>
            </div>

            {filteredBazaars.length === 0 ? (
              <div className="text-center py-48 bg-stone-50 dark:bg-stone-900/50 rounded-[4rem] border border-dashed border-stone-200 dark:border-stone-800">
                <Heart className="mx-auto mb-8 text-stone-200 dark:text-stone-800" size={80} />
                <h3 className="text-3xl font-serif mb-4">Empty Collection</h3>
                <p className="text-stone-400 dark:text-stone-500 font-light mb-8">Start exploring and save your favorites.</p>
                <button 
                  onClick={() => setActiveTab('all')}
                  className="px-8 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-bold"
                >
                  Go Explore
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredBazaars.map((bazaar) => (
                  <motion.div
                    key={bazaar.id}
                    layout
                    onClick={() => openPlaceDetails(bazaar)}
                    className="group bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-3xl transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-ramadhan-gold mb-2">
                          {bazaar.council || "Verified"}
                        </span>
                        <h3 className="text-2xl font-serif leading-tight">{bazaar.name}</h3>
                      </div>
                      <button 
                        onClick={(e) => toggleFavorite(e, bazaar.name)}
                        className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20"
                      >
                        <Heart size={18} fill="currentColor" />
                      </button>
                    </div>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mb-8 line-clamp-2 font-light">
                      {bazaar.address}
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-stone-50 dark:border-stone-800">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-stone-400">
                          <ThumbsUp size={16} />
                          <span className="text-xs font-bold">{votes[bazaar.name]?.up || 0}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-stone-300 group-hover:text-ramadhan-gold transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Place Details Modal */}
      <AnimatePresence>
        {selectedPlace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="bg-white dark:bg-stone-900 w-full max-w-6xl rounded-[4rem] overflow-hidden shadow-2xl relative grid grid-cols-1 lg:grid-cols-12 h-[90vh]"
            >
              <button 
                onClick={() => setSelectedPlace(null)}
                className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-colors z-30"
              >
                <X size={24} />
              </button>

              {/* Left: Visual & Info */}
              <div className="lg:col-span-5 relative h-64 lg:h-full bg-stone-100 dark:bg-stone-800">
                <img 
                  src={`https://picsum.photos/seed/${selectedPlace.name}/1200/1200`} 
                  alt={selectedPlace.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent" />
                <div className="absolute bottom-12 left-12 right-12 text-white">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <span className="text-xs font-black uppercase tracking-[0.4em] text-ramadhan-gold mb-4 block">
                      {selectedPlace.council || "Official Location"}
                    </span>
                    <div className="flex items-end justify-between mb-6">
                      <h2 className="text-6xl font-serif leading-[1.1] tracking-tighter">{selectedPlace.name}</h2>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="text-ramadhan-gold fill-ramadhan-gold" size={32} />
                          <span className="text-4xl font-black text-white">
                            {reviews.length > 0 
                              ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                              : "New"}
                          </span>
                        </div>
                        <span className="text-sm opacity-60">{reviews.length} reviews</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-base font-light opacity-70">
                        <MapPin size={20} className="text-ramadhan-gold" />
                        <span>{selectedPlace.address}</span>
                      </div>
                      <button 
                        onClick={handleSubscribe}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-sm font-bold transition-colors"
                      >
                        <Bell size={16} />
                        Get Updates
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Right: Actions & Reviews */}
              <div className="lg:col-span-7 p-12 lg:p-20 flex flex-col h-full overflow-hidden">
                <div className="mb-16">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Live Navigation</h4>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live Traffic
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <a 
                      href={`${selectedPlace.mapsUri}&layer=t`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center gap-4 px-8 py-5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-[2rem] font-black hover:scale-[1.02] transition-all shadow-2xl shadow-stone-900/20 dark:shadow-white/10"
                    >
                      <Navigation size={22} className="group-hover:rotate-12 transition-transform" />
                      Traffic Route
                    </a>
                    <a 
                      href={`${selectedPlace.mapsUri}&dirflg=r`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-4 px-8 py-5 border-2 border-stone-100 dark:border-stone-800 rounded-[2rem] font-black hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
                    >
                      <Bus size={22} />
                      Public Transit
                    </a>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-10">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Community Feedback</h4>
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={(e) => handleVote(e, selectedPlace.name, 1)}
                        className="flex items-center gap-3 text-stone-400 hover:text-green-500 transition-all hover:scale-110"
                      >
                        <ThumbsUp size={24} />
                        <span className="text-lg font-black">{votes[selectedPlace.name]?.up || 0}</span>
                      </button>
                      <button 
                        onClick={(e) => handleVote(e, selectedPlace.name, -1)}
                        className="flex items-center gap-3 text-stone-400 hover:text-red-500 transition-all hover:scale-110"
                      >
                        <ThumbsDown size={24} />
                        <span className="text-lg font-black">{votes[selectedPlace.name]?.down || 0}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-10 pr-6 custom-scrollbar mb-12">
                    {reviews.length === 0 ? (
                      <div className="text-center py-24 text-stone-300 dark:text-stone-700 italic font-serif text-2xl">
                        No stories shared yet. Be the first!
                      </div>
                    ) : (
                      reviews.map(review => (
                        <div key={review.id} className="group">
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-xs uppercase tracking-widest">{review.user_name}</span>
                            <div className="flex text-ramadhan-gold gap-0.5">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <Star key={i} size={10} fill="currentColor" />
                              ))}
                            </div>
                          </div>
                          <p className="text-stone-500 dark:text-stone-400 text-lg leading-relaxed font-light">
                            "{review.comment}"
                          </p>
                          <div className="h-px w-12 bg-stone-100 dark:bg-stone-800 mt-8 group-last:hidden" />
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSubmitReview} className="space-y-6 pt-10 border-t border-stone-100 dark:border-stone-800">
                    {user ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-ramadhan-gold text-white flex items-center justify-center text-xs font-bold">
                              {user.username[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-bold">Posting as {user.username}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 rounded-[2rem] px-4 py-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button 
                                key={star}
                                type="button"
                                onClick={() => setNewReview({...newReview, rating: star})}
                                className={`transition-all hover:scale-125 ${newReview.rating >= star ? 'text-ramadhan-gold' : 'text-stone-200 dark:text-stone-700'}`}
                              >
                                <Star size={18} fill="currentColor" />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="relative">
                          <textarea 
                            placeholder="Share your experience..."
                            required
                            value={newReview.comment}
                            onChange={e => setNewReview({...newReview, comment: e.target.value})}
                            className="w-full px-8 py-6 rounded-[2.5rem] bg-stone-50 dark:bg-stone-800 border-none focus:ring-2 focus:ring-ramadhan-olive outline-none transition-all h-32 resize-none text-base font-light"
                          />
                          <button 
                            type="submit"
                            disabled={submittingReview}
                            className="absolute bottom-6 right-6 p-4 bg-ramadhan-gold text-ramadhan-olive rounded-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-ramadhan-gold/20"
                          >
                            {submittingReview ? <Loader2 className="animate-spin" size={24} /> : <ChevronRight size={24} />}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 bg-stone-50 dark:bg-stone-800/50 rounded-[2.5rem]">
                        <p className="text-stone-500 dark:text-stone-400 mb-4">Sign in to share your review</p>
                        <button 
                          type="button"
                          onClick={() => setShowAuthModal(true)}
                          className="px-8 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold rounded-2xl hover:scale-105 transition-transform"
                        >
                          Sign In to Review
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
