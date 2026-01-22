import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine
} from 'recharts';
import { 
  Plus, User, Scale, Utensils, LayoutDashboard,
  Trash2, X, TrendingUp, Flame, Zap, 
  Sparkles, Coffee, ChefHat, Apple, Search, Check, Info, Calendar, Save, Target, Flag, Download, FileJson, Link, Upload
} from 'lucide-react';

// --- CONSTANTS ---
const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary', multiplier: 1.2 },
  light: { label: 'Lightly Active', multiplier: 1.375 },
  moderate: { label: 'Moderately Active', multiplier: 1.55 },
  active: { label: 'Very Active', multiplier: 1.725 },
  extra: { label: 'Extra Active', multiplier: 1.9 }
};

const VIETNAMESE_FOOD_DB = [
  { name: "Phở Bò (Beef Pho)", cal: 450 },
  { name: "Phở Gà (Chicken Pho)", cal: 400 },
  { name: "Bánh Mì Đặc Biệt", cal: 450 },
  { name: "Cơm Tấm Sườn Bì Chả", cal: 650 },
  { name: "Bún Chả Hà Nội", cal: 520 },
  { name: "Bún Bò Huế", cal: 550 },
  { name: "Bún Riêu Cua", cal: 450 },
  { name: "Cơm Gà Xối Mỡ", cal: 700 },
  { name: "Gỏi Cuốn (2 pcs)", cal: 160 },
  { name: "Cà Phê Sữa Đá", cal: 180 },
  { name: "Trà Sữa Trân Châu", cal: 450 }
];

const calculateNutrition = (profile) => {
  const { age, gender, height, weight, activityLevel, targetWeight, startDate, targetDate } = profile;
  if (!age || !height || !weight || !startDate || !targetDate) return null;
  const end = new Date(targetDate);
  const today = new Date();
  const daysRemaining = Math.max(1, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr = gender === 'male' ? bmr + 5 : bmr - 161;
  const tdee = bmr * (ACTIVITY_LEVELS[activityLevel]?.multiplier || 1.2);
  const weightDiff = targetWeight - weight; 
  const dailyAdjustment = (weightDiff * 7700) / daysRemaining;
  return { bmr, tdee, targetCalories: Math.round(tdee + dailyAdjustment) };
};

const getTodayKey = () => new Date().toISOString().split('T')[0];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showOuttakeModal, setShowOuttakeModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [editingMealType, setEditingMealType] = useState(null); 
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelection, setTempSelection] = useState([]);
  const [mealPlans, setMealPlans] = useState({ breakfast: [], lunch: [], dinner: [], other: [] });
  const [manualName, setManualName] = useState("");
  const [manualCal, setManualCal] = useState("");
  const fileInputRef = useRef(null);

  // File System State
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState("No file linked");
  
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('nutri_profile_v13');
    return saved ? JSON.parse(saved) : {
      name: 'User', gender: 'male', age: 25, height: 175, weight: 70, targetWeight: 65,
      activityLevel: 'moderate', startDate: getTodayKey(), targetDate: '2026-03-01'
    };
  });
  
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('nutri_logs_v13');
    return saved ? JSON.parse(saved) : {};
  });

  // --- AUTO-SAVE TO FILE SYSTEM ---
  useEffect(() => {
    localStorage.setItem('nutri_profile_v13', JSON.stringify(profile));
    localStorage.setItem('nutri_logs_v13', JSON.stringify(logs));
    
    // Automatic write to local file if linked
    if (fileHandle) {
      const autoSave = async () => {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify({ profile, logs, mealPlans }, null, 2));
          await writable.close();
        } catch (err) {
          console.error("Auto-save failed", err);
        }
      };
      autoSave();
    }
  }, [profile, logs, mealPlans, fileHandle]);

  const stats = useMemo(() => calculateNutrition(profile), [profile]);
  const todayKey = getTodayKey();
  const todayLog = logs[todayKey] || { weight: profile.weight, intake: 0, outtake: 0, foods: [], activities: [] };
  const netToday = todayLog.intake - (todayLog.outtake || 0);
  const isOverToday = netToday > (stats?.targetCalories || 0);

  // --- FILE SYSTEM ACCESS ---
  const linkLocalFile = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Data File', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        await handle.requestPermission({ mode: 'readwrite' });
      }

      const file = await handle.getFile();
      const content = await file.text();
      
      if (content) {
        const imported = JSON.parse(content);
        if (imported.profile) setProfile(imported.profile);
        if (imported.logs) setLogs(imported.logs);
        if (imported.mealPlans) setMealPlans(imported.mealPlans);
      }

      setFileHandle(handle);
      setFileName(handle.name);
      alert("File linked successfully. App is now syncing to " + handle.name);
    } catch (err) {
      console.error("File access denied", err);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify({ profile, logs, mealPlans }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `nutritrack_backup_${todayKey}.json`);
    linkElement.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.profile) setProfile(imported.profile);
        if (imported.logs) setLogs(imported.logs);
        if (imported.mealPlans) setMealPlans(imported.mealPlans);
        alert("Data imported!");
      } catch (err) { alert("Invalid format"); }
    };
    reader.readAsText(file);
  };

  // --- ACTIONS ---
  const addEntry = (type) => {
    if (!manualName || !manualCal) return;
    const item = { name: manualName, cal: parseFloat(manualCal), id: Date.now() };
    const current = logs[todayKey] || { weight: profile.weight, intake: 0, outtake: 0, foods: [], activities: [] };
    if (type === 'food') {
      setLogs({ ...logs, [todayKey]: { ...current, intake: (current.intake || 0) + item.cal, foods: [...(current.foods || []), item] }});
      setShowFoodModal(false);
    } else {
      setLogs({ ...logs, [todayKey]: { ...current, outtake: (current.outtake || 0) + item.cal, activities: [...(current.activities || []), item] }});
      setShowOuttakeModal(false);
    }
    setManualName(""); setManualCal("");
  };

  const removeEntry = (type, id) => {
    const current = logs[todayKey];
    if (type === 'food') {
      const item = current.foods.find(f => f.id === id);
      setLogs({ ...logs, [todayKey]: { ...current, foods: current.foods.filter(f => f.id !== id), intake: current.intake - (item?.cal || 0) }});
    } else {
      const item = current.activities.find(a => a.id === id);
      setLogs({ ...logs, [todayKey]: { ...current, activities: current.activities.filter(a => a.id !== id), outtake: current.outtake - (item?.cal || 0) }});
    }
  };

  const trendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      const log = logs[key];
      const target = stats?.targetCalories || 0;
      const net = log ? (log.intake || 0) - (log.outtake || 0) : 0;
      const weight = log ? log.weight : 0;
      return {
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        weight: weight,
        netCalories: Math.round(net),
        target: target
      };
    });
  }, [logs, profile.weight, stats]);

  const toggleSelection = (food) => {
    if (tempSelection.find(s => s.name === food.name)) {
      setTempSelection(tempSelection.filter(s => s.name !== food.name));
    } else if (tempSelection.length < 2) {
      setTempSelection([...tempSelection, food]);
    }
  };

  const applyMealPlan = () => {
    setMealPlans({ ...mealPlans, [editingMealType]: tempSelection });
    setEditingMealType(null); setTempSelection([]); setSearchQuery("");
  };

  const logPlannedMeal = (type) => {
    const items = mealPlans[type];
    if (!items.length) return;
    const current = logs[todayKey] || { weight: profile.weight, intake: 0, outtake: 0, foods: [], activities: [] };
    const totalCal = items.reduce((acc, curr) => acc + curr.cal, 0);
    const newFoods = items.map(i => ({ ...i, id: Date.now() + Math.random() }));
    setLogs({ ...logs, [todayKey]: { ...current, intake: (current.intake || 0) + totalCal, foods: [...(current.foods || []), ...newFoods] }});
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-48 font-sans text-slate-900 select-none w-full overflow-x-hidden relative">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b px-6 py-4 flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black">N</div>
           <h1 className="text-lg font-black tracking-tight">NutriTrack</h1>
        </div>
        <div className="flex items-center gap-3">
          {fileHandle && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
          <button onClick={() => setActiveTab('profile')} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <User size={22} />
          </button>
        </div>
      </header>

      <main className="w-full p-4 space-y-6">
        {activeTab === 'dashboard' && (
          <>
            <div className={`bg-white rounded-[40px] p-8 shadow-sm border transition-all ${isOverToday ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-100'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Net</h2>
                  <div className={`text-5xl font-black ${isOverToday ? 'text-red-500' : 'text-slate-900'}`}>{Math.round(netToday)}</div>
                  <div className="text-xs font-bold text-slate-300 mt-1">Target: {stats?.targetCalories} kcal</div>
                </div>
                <div className={`p-4 rounded-3xl ${isOverToday ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}><Zap size={28} /></div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-50 p-3 rounded-2xl">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Intake</div>
                  <div className="font-black text-indigo-600">+{Math.round(todayLog.intake)}</div>
                </div>
                <div className="flex-1 bg-slate-50 p-3 rounded-2xl">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Outtake</div>
                  <div className="font-black text-orange-500">-{Math.round(todayLog.outtake || 0)}</div>
                </div>
              </div>
            </div>

            <div onClick={() => setShowWeightModal(true)} className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><Scale size={24}/></div>
                <div><div className="text-[10px] font-black text-slate-400 uppercase">Weight</div><div className="text-xl font-black">{todayLog.weight} kg</div></div>
              </div>
              <Plus size={20} className="text-indigo-600" />
            </div>

            <section className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Recent Logs</h3>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 pb-4 scrollbar-hide">
                {todayLog.foods.length === 0 && todayLog.activities.length === 0 && (
                   <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase tracking-widest">No entries yet</p>
                )}
                {todayLog.foods.map(f => (
                  <LogItem key={f.id} title={f.name} val={`+${f.cal}`} icon={<Utensils size={16}/>} onDel={() => removeEntry('food', f.id)} color="indigo" />
                ))}
                {todayLog.activities?.map(a => (
                  <LogItem key={a.id} title={a.name} val={`-${a.cal}`} icon={<Flame size={16}/>} onDel={() => removeEntry('act', a.id)} color="orange" />
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <h4 className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-2">Planned Total</h4>
                  <div className="text-4xl font-black">
                    {Object.values(mealPlans).flat().reduce((a, b) => a + b.cal, 0)} <span className="text-lg opacity-60">kcal</span>
                  </div>
                </div>
                <div className="text-right">
                  <h4 className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-2">Target</h4>
                  <div className="text-2xl font-black">{stats?.targetCalories} <span className="text-sm opacity-60">kcal</span></div>
                </div>
              </div>
              <Sparkles className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
            </div>
            <div className="space-y-4">
              <MealSlot icon={<Coffee/>} label="Breakfast" selection={mealPlans.breakfast} onClick={() => setEditingMealType('breakfast')} onLog={() => logPlannedMeal('breakfast')} />
              <MealSlot icon={<ChefHat/>} label="Lunch" selection={mealPlans.lunch} onClick={() => setEditingMealType('lunch')} onLog={() => logPlannedMeal('lunch')} />
              <MealSlot icon={<Utensils/>} label="Dinner" selection={mealPlans.dinner} onClick={() => setEditingMealType('dinner')} onLog={() => logPlannedMeal('dinner')} />
              <MealSlot icon={<Apple/>} label="Other / Snack" selection={mealPlans.other} onClick={() => setEditingMealType('other')} onLog={() => logPlannedMeal('other')} />
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 pb-4">
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Scale size={18} className="text-indigo-600"/><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Weight Log (KG)</h3>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#cbd5e1'}} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip content={<CustomTooltip unit="kg" />} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="weight" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Flame size={18} className="text-orange-500"/><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Net Cal Trend (Kcal)</h3>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ left: -10 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#cbd5e1'}} />
                    <Tooltip content={<CustomTooltip unit="kcal" />} cursor={{fill: 'transparent'}} />
                    <ReferenceLine y={stats?.targetCalories} stroke="#e2e8f0" strokeDasharray="5 5" label={{ position: 'right', value: 'T', fill: '#cbd5e1', fontSize: 10, fontWeight: 'bold' }} />
                    <Bar dataKey="netCalories" radius={[6, 6, 6, 6]} barSize={24}>
                      {trendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.netCalories > entry.target ? '#ef4444' : '#4f46e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
           <div className="space-y-6 pb-4 animate-in slide-in-from-bottom-4">
              {/* FILE SYNC SECTION */}
              <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <FileJson size={20} className="text-indigo-200" />
                        <h3 className="font-black uppercase text-xs tracking-widest text-indigo-100">Local File Auto-Sync</h3>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl mb-6 backdrop-blur-sm border border-white/10">
                        <div className="text-[10px] font-black uppercase text-indigo-200 mb-1">Target File:</div>
                        <div className="text-sm font-bold truncate">{fileName}</div>
                    </div>
                    <button 
                        onClick={linkLocalFile}
                        className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                    >
                        <Link size={16} />
                        {fileHandle ? "CHANGE LINKED FILE" : "SET STORAGE FILE"}
                    </button>
                    <p className="text-[9px] text-indigo-200 mt-4 text-center font-bold uppercase leading-relaxed">
                        Changes are automatically saved to this file in real-time.
                    </p>
                </div>
                <Sparkles className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 rotate-12" />
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-slate-100 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-black uppercase text-xs tracking-widest text-slate-400">User Profile</h3>
                  <User className="text-indigo-600" size={20} />
                </div>
                <div className="space-y-4">
                    <input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <select className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none" value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})}>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                        <input type="number" className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm outline-none" value={profile.age} onChange={e => setProfile({...profile, age: parseInt(e.target.value)})} />
                    </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-slate-100 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-black uppercase text-xs tracking-widest text-slate-400">Weight & Dates</h3>
                  <Target className="text-orange-500" size={20} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400">Current (kg)</label>
                        <input type="number" step="0.1" className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm mt-1" value={profile.weight} onChange={e => setProfile({...profile, weight: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400">Target (kg)</label>
                        <input type="number" step="0.1" className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm mt-1 border-2 border-orange-100" value={profile.targetWeight} onChange={e => setProfile({...profile, targetWeight: parseFloat(e.target.value)})} />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <input type="date" className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm" value={profile.startDate} onChange={e => setProfile({...profile, startDate: e.target.value})} />
                    <input type="date" className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-sm border-2 border-indigo-100" value={profile.targetDate} onChange={e => setProfile({...profile, targetDate: e.target.value})} />
                </div>
              </div>

              <div className="bg-slate-100/50 p-8 rounded-[40px] space-y-6">
                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400">Manual Backup</h3>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleExport} className="bg-white text-slate-600 p-4 rounded-2xl font-black text-xs flex flex-col items-center gap-2 shadow-sm">
                        <Download size={20} /> EXPORT
                    </button>
                    <button onClick={() => fileInputRef.current.click()} className="bg-white text-slate-600 p-4 rounded-2xl font-black text-xs flex flex-col items-center gap-2 shadow-sm">
                        <Upload size={20} /> IMPORT
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
                </div>
              </div>

              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest">Reset Local Memory</button>
           </div>
        )}
      </main>

      {activeTab === 'dashboard' && (
        <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
           <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowFoodModal(true)} className="bg-indigo-600 text-white p-5 rounded-[24px] font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-indigo-100/40"><Plus size={20}/> Intake</button>
              <button onClick={() => setShowOuttakeModal(true)} className="bg-orange-500 text-white p-5 rounded-[24px] font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-orange-100/40"><Flame size={20}/> Outtake</button>
            </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-[6px] flex justify-around items-center z-50">
        <NavBtn act={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={22}/>} />
        <NavBtn act={activeTab === 'planner'} onClick={() => setActiveTab('planner')} icon={<ChefHat size={22}/>} />
        <NavBtn act={activeTab === 'trends'} onClick={() => setActiveTab('trends')} icon={<TrendingUp size={22}/>} />
        <NavBtn act={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={22}/>} />
      </nav>

      {showFoodModal && (
        <ManualEntryModal title="Log Intake" color="indigo" onCancel={() => setShowFoodModal(false)} onAdd={() => addEntry('food')} name={manualName} setName={setManualName} cal={manualCal} setCal={setManualCal} />
      )}
      {showOuttakeModal && (
        <ManualEntryModal title="Log Exercise" color="orange" onCancel={() => setShowOuttakeModal(false)} onAdd={() => addEntry('act')} name={manualName} setName={setManualName} cal={manualCal} setCal={setManualCal} />
      )}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 text-center shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6">Weight (kg)</h3>
            <input id="w-val-input" type="number" step="0.1" defaultValue={profile.weight} className="w-full text-5xl font-black text-center outline-none bg-transparent mb-8" />
            <div className="flex gap-4">
              <button onClick={() => setShowWeightModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400">Cancel</button>
              <button onClick={() => {
                const weight = parseFloat(document.getElementById('w-val-input').value);
                setProfile({...profile, weight});
                setLogs({...logs, [todayKey]: { ...todayLog, weight }});
                setShowWeightModal(false);
              }} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-black text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {editingMealType && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black capitalize">{editingMealType}</h2>
            <button onClick={() => setEditingMealType(null)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pb-20 scrollbar-hide">
             <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search food..." className="w-full bg-slate-50 p-4 rounded-2xl font-bold" />
             {VIETNAMESE_FOOD_DB.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map(food => {
                const isSelected = tempSelection.find(s => s.name === food.name);
                return (
                  <div key={food.name} onClick={() => toggleSelection(food)} className={`p-4 rounded-2xl border flex justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-white'}`}>
                    <div><div className="font-bold">{food.name}</div><div className="text-[10px] text-slate-400">{food.cal} kcal</div></div>
                    {isSelected ? <Check className="text-indigo-600" /> : <Plus className="text-slate-300" />}
                  </div>
                )
             })}
          </div>
          <button onClick={applyMealPlan} className="fixed bottom-10 left-6 right-6 bg-indigo-600 text-white p-5 rounded-[24px] font-black">Apply Selection</button>
        </div>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---
function NavBtn({ act, onClick, icon }) {
  return (<button onClick={onClick} className={`p-4 rounded-2xl transition-all ${act ? 'bg-indigo-50 text-indigo-600' : 'text-slate-200'}`}>{icon}</button>);
}

function MealSlot({ icon, label, selection, onClick, onLog }) {
  const total = selection.reduce((a, b) => a + b.cal, 0);
  return (
    <div className="bg-white p-5 rounded-[32px] border border-slate-100 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">{icon}</div>
          <div><span className="text-xs font-black text-slate-400">{label}</span>{total > 0 && <div className="text-[10px] font-bold text-indigo-600">{total} kcal</div>}</div>
        </div>
        <button onClick={onClick} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Config</button>
      </div>
      {selection.length > 0 ? (
        <div className="space-y-2">
          {selection.map((s, i) => (<div key={i} className="p-3 bg-slate-50 rounded-2xl text-sm font-bold">{s.name}</div>))}
          <button onClick={onLog} className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black">Log Today</button>
        </div>
      ) : (<div onClick={onClick} className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-300">Tap to add</div>)}
    </div>
  );
}

function ManualEntryModal({ title, color, onCancel, onAdd, name, setName, cal, setCal }) {
  const bg = color === 'indigo' ? 'bg-indigo-600' : 'bg-orange-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl">
        <h3 className="text-center font-black uppercase text-xs text-slate-400 mb-6">{title}</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="w-full bg-slate-50 p-4 rounded-2xl font-bold mb-4 outline-none" />
        <input value={cal} onChange={e => setCal(e.target.value)} type="number" placeholder="Kcal" className="w-full bg-slate-50 p-4 rounded-2xl font-bold mb-6 outline-none" />
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400">Cancel</button>
          <button onClick={onAdd} className={`flex-1 py-4 ${bg} rounded-2xl font-black text-white`}>Add</button>
        </div>
      </div>
    </div>
  );
}

function LogItem({ title, val, icon, onDel, color }) {
  const c = color === 'indigo' ? 'text-indigo-600 bg-indigo-50' : 'text-orange-500 bg-orange-50';
  return (
    <div className="bg-white p-4 rounded-[28px] flex justify-between items-center border border-slate-100 shadow-sm group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c}`}>{icon}</div>
        <div><div className="font-bold text-sm text-slate-700">{title}</div><div className={`text-[10px] font-black uppercase ${color === 'indigo' ? 'text-indigo-400' : 'text-orange-400'}`}>{val} kcal</div></div>
      </div>
      <button onClick={onDel} className="p-2 text-slate-200 hover:text-red-500"><Trash2 size={16}/></button>
    </div>
  );
}

function CustomTooltip({ active, payload, unit }) {
  if (active && payload && payload.length) {
    return (<div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-[10px] font-black shadow-xl">{payload[0].value} {unit}</div>);
  }
  return null;
}