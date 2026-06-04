import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Plus, Users, X, MapPin, Check, ChevronLeft, ChevronRight, List, LogOut, Edit, Trash2, UserPlus, Search, Bell, Layers, ChevronDown, Clock, MessageCircle, CheckCircle, AlertCircle, Info, HelpCircle, Sprout, Lock, Eye, EyeOff, Link2, Link2Off, LogIn } from 'lucide-react';
import { supabase } from './supabaseClient';

// ฟังก์ชันแปลงวันที่เป็นภาษาไทย
const formatDateThai = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
};

// ฟังก์ชันสำหรับแสดงช่วงวันที่ (กรณีหลายวัน)
const formatTaskDateRange = (startDateStr, endDateStr) => {
  const start = formatDateThai(startDateStr);
  if (endDateStr && endDateStr !== startDateStr) {
    const end = formatDateThai(endDateStr);
    return `${start} - ${end}`;
  }
  return start;
};

// เช็คว่าวันที่เป้าหมาย อยู่ในระหว่างช่วงเวลาของกิจกรรมหรือไม่
const isDateInTaskRange = (targetDateStr, startDateStr, endDateStr) => {
  if (!startDateStr) return false;
  const targetTime = new Date(targetDateStr).getTime();
  const startTime = new Date(startDateStr).getTime();
  const endTime = endDateStr ? new Date(endDateStr).getTime() : startTime;
  return targetTime >= startTime && targetTime <= endTime;
};

// ฟังก์ชันจัดรูปแบบเวลา
const formatTimeThai = (timeString) => {
  if (!timeString) return '';
  return `${timeString.substring(0, 5)} น.`;
};

const getInitials = (name) => {
  if (!name) return '';
  const cleanName = name.replace(/^(ผอ\.|ครู)/, '').trim();
  return cleanName.charAt(0);
};

// ฟังก์ชันสำหรับเข้ารหัสรหัสผ่าน (Hash) ด้วย SHA-256
const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isLineVerifying, setIsLineVerifying] = useState(false);

  // --- Real-time Clock สำหรับเช็คว่างานเลยเวลาหรือยัง ---
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Modal State (Custom Popup) ---
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const showModal = (title, message, type = 'info', onConfirm = null) => {
    setModal({ isOpen: true, title, message, type, onConfirm });
  };

  const closeModal = () => setModal({ ...modal, isOpen: false });

  const handleModalConfirm = async () => {
    if (modal.onConfirm) {
      await modal.onConfirm();
    }
    closeModal();
  };

  // --- Auth & Staff State ---
  const [staffList, setStaffList] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('schoolTaskUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // --- Core State ---
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listFilter, setListFilter] = useState('all'); 
  
  // --- Calendar State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayTasksDate, setSelectedDayTasksDate] = useState(null);

  // --- Staff Management State ---
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [newStaff, setNewStaff] = useState({ name: '', department: '', role: 'staff', username: '', password: '' });
  const [showStaffPassword, setShowStaffPassword] = useState(false); // เพิ่ม State ควบคุมการแสดงรหัสผ่านบุคลากร

  // --- Department Management State ---
  const [departments, setDepartments] = useState([]);
  const [newDept, setNewDept] = useState('');
  const [editingDept, setEditingDept] = useState(null);
  const [editDeptInput, setEditDeptInput] = useState('');

  // --- Pagination State ---
  const [currentPageTasks, setCurrentPageTasks] = useState(1);
  const [currentPageStaff, setCurrentPageStaff] = useState(1);
  const [currentPageDepts, setCurrentPageDepts] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // --- Task Form State ---
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', department: '', description: '', date: '', end_date: '', time: '', location: '', assignees: [] });
  
  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  
  // Notification State
  const notifRef = useRef(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [seenNotifIds, setSeenNotifIds] = useState([]); 
  
  // Notification Pagination State
  const [currentPageNotif, setCurrentPageNotif] = useState(1);
  const NOTIFS_PER_PAGE = 5;

  // Profile Dropdown State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      const storedSeen = localStorage.getItem(`seenNotifs_${currentUser.id}`);
      if (storedSeen) {
        try {
          setSeenNotifIds(JSON.parse(storedSeen));
        } catch (e) {
          setSeenNotifIds([]);
        }
      }
    } else {
      setSeenNotifIds([]);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleLineCallback(code, state);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: deptData } = await supabase.from('departments').select('name').order('id');
      if (deptData) setDepartments(deptData.map(d => d.name));

      const { data: staffData } = await supabase.from('staff').select('*').order('name');
      if (staffData) {
        setStaffList(staffData);
        const savedUser = localStorage.getItem('schoolTaskUser');
        if (savedUser) {
           const parsedUser = JSON.parse(savedUser);
           const updatedDbUser = staffData.find(s => s.id === parsedUser.id);
           if (updatedDbUser) {
             setCurrentUser(updatedDbUser);
             localStorage.setItem('schoolTaskUser', JSON.stringify(updatedDbUser));
           }
        }
      }

      const { data: taskData } = await supabase.from('tasks').select('*, task_assignees ( staff_id )');
      if (taskData) {
        const formattedTasks = taskData.map(t => ({
          ...t,
          assignees: t.task_assignees ? t.task_assignees.map(a => a.staff_id) : []
        }));
        setTasks(formattedTasks);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showModal("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลจากระบบได้", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLineConnect = () => {
    const clientId = import.meta.env.VITE_LINE_LOGIN_CLIENT_ID; 
    if (!clientId) {
      showModal("ข้อผิดพลาด", "กรุณาตั้งค่า VITE_LINE_LOGIN_CLIENT_ID ก่อนครับ", "error");
      return;
    }
    const redirectUri = window.location.origin;
    const state = currentUser.id;
    const scope = "profile openid";
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;
    window.location.href = lineAuthUrl;
  };

  const handleLineCallback = async (code, stateId) => {
    setIsLineVerifying(true);
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
      const { data, error } = await supabase.functions.invoke('line-auth', {
        body: { code, redirectUri: window.location.origin, userId: stateId }
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      showModal('สำเร็จ', 'เชื่อมต่อ LINE สำเร็จ! ระบบจะส่งการแจ้งเตือนงานให้คุณทาง LINE', 'success');
      fetchData();
    } catch (err) {
      console.error('LINE Connect Error:', err);
      showModal('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อบัญชี LINE ได้ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsLineVerifying(false);
    }
  };

  const handleLineDisconnect = () => {
    showModal(
      'ยืนยันการยกเลิกเชื่อมต่อ', 
      'คุณต้องการยกเลิกการเชื่อมต่อบัญชี LINE ใช่หรือไม่?\nระบบจะไม่สามารถส่งการแจ้งเตือนกิจกรรมผ่าน LINE ให้คุณได้อีก', 
      'confirm',
      async () => {
        try {
          const { error } = await supabase
            .from('staff')
            .update({ line_user_id: null, line_picture_url: null })
            .eq('id', currentUser.id);

          if (error) throw error;

          const updatedUser = { ...currentUser, line_user_id: null, line_picture_url: null };
          setCurrentUser(updatedUser);
          localStorage.setItem('schoolTaskUser', JSON.stringify(updatedUser));
          
          await fetchData();
          showModal('สำเร็จ', 'ยกเลิกการเชื่อมต่อบัญชี LINE เรียบร้อยแล้ว', 'success');
        } catch (error) {
          console.error('Error disconnecting LINE:', error);
          showModal('ข้อผิดพลาด', 'ไม่สามารถยกเลิกการเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง', 'error');
        }
      }
    );
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setIsProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isUpcoming = (dateStr, timeStr, endDateStr) => {
    const targetDateStr = endDateStr || dateStr;
    if (!targetDateStr) return false;
    const [year, month, day] = targetDateStr.split('-');
    const taskDateTime = new Date(year, month - 1, day);
    
    if (timeStr && !endDateStr) {
      const [hours, minutes] = timeStr.split(':');
      taskDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    } else {
      taskDateTime.setHours(23, 59, 59, 999);
    }
    return taskDateTime >= currentTime;
  };

  const compareTasks = (a, b) => {
    const [yearA, monthA, dayA] = a.date.split('-');
    const dateA = new Date(yearA, monthA - 1, dayA);
    if (a.time) {
      const [h, m] = a.time.split(':');
      dateA.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    } else {
      dateA.setHours(23, 59, 59, 999);
    }

    const [yearB, monthB, dayB] = b.date.split('-');
    const dateB = new Date(yearB, monthB - 1, dayB);
    if (b.time) {
      const [h, m] = b.time.split(':');
      dateB.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    } else {
      dateB.setHours(23, 59, 59, 999);
    }
    return dateA - dateB;
  };

  const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
  const tomorrowObj = new Date(currentTime);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = `${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth() + 1).padStart(2, '0')}-${String(tomorrowObj.getDate()).padStart(2, '0')}`;

  const myPendingTasks = currentUser ? tasks
    .filter(t => t.assignees.includes(currentUser.id) && isUpcoming(t.date, t.time, t.end_date))
    .sort(compareTasks) 
    : [];

  const alertedTasksRef = useRef(new Set());

  useEffect(() => {
    if (!currentUser || myPendingTasks.length === 0) return;
    
    myPendingTasks.forEach(task => {
      if (!task.time || alertedTasksRef.current.has(task.id)) return;
      
      const [year, month, day] = task.date.split('-');
      const [h, m] = task.time.split(':');
      const taskDateTime = new Date(year, month - 1, day, parseInt(h, 10), parseInt(m, 10), 0, 0);
      
      const timeDiffMs = taskDateTime - currentTime;
      const timeDiffMinutes = Math.floor(timeDiffMs / 60000);
      
      // แจ้งเตือนก่อน 5 นาที
      if (timeDiffMinutes >= 0 && timeDiffMinutes <= 5) {
        showModal('แจ้งเตือนกิจกรรมใกล้ถึงเวลา', `กิจกรรม "${task.title}" จะเริ่มในอีก ${timeDiffMinutes} นาที (เวลา ${formatTimeThai(task.time)})`, 'info');
        alertedTasksRef.current.add(task.id);
      }
    });
  }, [currentTime, myPendingTasks, currentUser]);

  const displayedListTasks = tasks
    .filter(t => isUpcoming(t.date, t.time, t.end_date))
    .filter(t => listFilter === 'all' || (listFilter === 'mine' && currentUser && t.assignees.includes(currentUser.id)))
    .sort(compareTasks);

  const filteredStaff = staffList.filter(staff => 
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    staff.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const totalPagesTasks = Math.ceil(displayedListTasks.length / ITEMS_PER_PAGE);
    if (currentPageTasks > totalPagesTasks && totalPagesTasks > 0) setCurrentPageTasks(totalPagesTasks);
    
    const totalPagesStaff = Math.ceil(filteredStaff.length / ITEMS_PER_PAGE);
    if (currentPageStaff > totalPagesStaff && totalPagesStaff > 0) setCurrentPageStaff(totalPagesStaff);
    
    const totalPagesDepts = Math.ceil(departments.length / ITEMS_PER_PAGE);
    if (currentPageDepts > totalPagesDepts && totalPagesDepts > 0) setCurrentPageDepts(totalPagesDepts);
  }, [displayedListTasks.length, filteredStaff.length, departments.length, currentPageTasks, currentPageStaff, currentPageDepts]);

  const totalNotifPages = Math.ceil(myPendingTasks.length / NOTIFS_PER_PAGE);
  useEffect(() => {
    if (currentPageNotif > totalNotifPages && totalNotifPages > 0) {
      setCurrentPageNotif(totalNotifPages);
    }
  }, [myPendingTasks.length, currentPageNotif, totalNotifPages]);

  const paginatedNotifs = myPendingTasks.slice((currentPageNotif - 1) * NOTIFS_PER_PAGE, currentPageNotif * NOTIFS_PER_PAGE);
  const unreadNotifCount = myPendingTasks.filter(t => !seenNotifIds.includes(String(t.id))).length;

  const handleToggleNotif = () => {
    const willOpen = !isNotifOpen;
    setIsNotifOpen(willOpen);
    
    if (willOpen && myPendingTasks.length > 0) {
      const currentIds = myPendingTasks.map(t => String(t.id));
      setSeenNotifIds(currentIds);
      if (currentUser) {
        localStorage.setItem(`seenNotifs_${currentUser.id}`, JSON.stringify(currentIds));
      }
    }
  };

  const toggleAssignee = (id) => {
    setNewTask(prev => ({
      ...prev,
      assignees: prev.assignees.includes(id) ? prev.assignees.filter(a => a !== id) : [...prev.assignees, id]
    }));
  };

  const removeAssignee = (e, id) => {
    e.stopPropagation();
    setNewTask(prev => ({ ...prev, assignees: prev.assignees.filter(a => a !== id) }));
  };

  const handleToggleAllAssignees = () => {
    if (newTask.assignees.length === staffList.length) {
      setNewTask(prev => ({ ...prev, assignees: [] }));
    } else {
      setNewTask(prev => ({ ...prev, assignees: staffList.map(s => s.id) }));
    }
  };

  const handleAddDept = async () => {
    if (newDept.trim() && !departments.includes(newDept.trim())) {
      await supabase.from('departments').insert([{ name: newDept.trim() }]);
      await fetchData();
      setNewDept('');
      showModal('สำเร็จ', 'เพิ่มฝ่ายเรียบร้อยแล้ว', 'success');
    }
  };

  const handleSaveEditDept = async (oldName) => {
    if (!editDeptInput.trim() || editDeptInput.trim() === oldName) {
      setEditingDept(null); return;
    }
    const newName = editDeptInput.trim();
    await supabase.from('departments').update({ name: newName }).eq('name', oldName);
    await supabase.from('staff').update({ department: newName }).eq('department', oldName);
    await supabase.from('tasks').update({ department: newName }).eq('department', oldName);
    await fetchData();
    setEditingDept(null);
    showModal('สำเร็จ', 'แก้ไขข้อมูลฝ่ายเรียบร้อยแล้ว', 'success');
  };

  const handleDeleteDept = (deptName) => {
    showModal(
      'ยืนยันการลบฝ่าย', 
      `คุณต้องการลบฝ่าย "${deptName}" ใช่หรือไม่?\nข้อมูลฝ่ายในกิจกรรมและบุคลากรที่เกี่ยวข้องจะถูกล้างค่าออก`, 
      'confirm',
      async () => {
        await supabase.from('departments').delete().eq('name', deptName);
        await supabase.from('staff').update({ department: '' }).eq('department', deptName);
        await supabase.from('tasks').update({ department: '' }).eq('department', deptName);
        await fetchData();
        showModal('สำเร็จ', 'ลบฝ่ายเรียบร้อยแล้ว', 'success');
      }
    );
  };

  const handleSaveTask = async () => {
    if (!newTask.title || !newTask.date) return;

    if (newTask.end_date && new Date(newTask.end_date) < new Date(newTask.date)) {
      showModal('ข้อผิดพลาด', 'วันที่สิ้นสุด ต้องไม่ก่อนวันที่เริ่มต้น', 'error');
      return;
    }
    
    try {
      let currentTaskId = editingTaskId;
      const isNewTask = !editingTaskId;

      const payload = {
        title: newTask.title, 
        department: newTask.department, 
        description: newTask.description, 
        date: newTask.date, 
        end_date: newTask.end_date || null,
        time: newTask.time || null, 
        location: newTask.location
      };

      if (editingTaskId) {
        await supabase.from('tasks').update(payload).eq('id', editingTaskId);
        await supabase.from('task_assignees').delete().eq('task_id', editingTaskId);
      } else {
        const { data: insertedTask, error } = await supabase.from('tasks').insert(payload).select().single();
        if (error) throw error;
        currentTaskId = insertedTask.id;
      }

      if (newTask.assignees.length > 0 && currentTaskId) {
        const assigneeInserts = newTask.assignees.map(staff_id => ({ task_id: currentTaskId, staff_id }));
        await supabase.from('task_assignees').insert(assigneeInserts);

        const assignedStaffWithLine = newTask.assignees
          .map(id => staffList.find(s => s.id === id))
          .filter(staff => staff && staff.line_user_id);
        
        const lineUserIds = assignedStaffWithLine.map(staff => staff.line_user_id);

        if (lineUserIds.length > 0) {
          supabase.functions.invoke('notify-new-task', {
            body: {
              task: { ...newTask, endDate: newTask.end_date },
              userIds: lineUserIds,
              assignerName: currentUser.name,
              siteUrl: window.location.origin,
              actionType: isNewTask ? 'create' : 'update'
            }
          }).catch(err => console.error("Error invoking notify-new-task:", err));
        }
      }

      await fetchData();
      setIsModalOpen(false);
      setEditingTaskId(null);
      setNewTask({ title: '', department: '', description: '', date: '', end_date: '', time: '', location: '', assignees: [] });
      showModal('สำเร็จ', 'บันทึกกิจกรรมเรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('Error saving task:', error);
      showModal('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  };

  const handleEditTask = (task) => {
    setNewTask({ 
      title: task.title, 
      department: task.department || '', 
      description: task.description || '', 
      date: task.date, 
      end_date: task.end_date || '',
      time: task.time || '', 
      location: task.location || '', 
      assignees: task.assignees || [] 
    });
    setEditingTaskId(task.id);
    setIsModalOpen(true);
  };

  const handleDeleteTask = (id) => {
    showModal('ยืนยันการลบกิจกรรม', 'คุณต้องการลบกิจกรรมนี้ใช่หรือไม่?', 'confirm', async () => {
      
      const taskToDelete = tasks.find(t => t.id === id);
      if (taskToDelete && taskToDelete.assignees.length > 0) {
        const assignedStaffWithLine = taskToDelete.assignees
          .map(staffId => staffList.find(s => s.id === staffId))
          .filter(staff => staff && staff.line_user_id);
        
        const lineUserIds = assignedStaffWithLine.map(staff => staff.line_user_id);

        if (lineUserIds.length > 0) {
          supabase.functions.invoke('notify-new-task', {
            body: {
              task: { ...taskToDelete, endDate: taskToDelete.end_date },
              userIds: lineUserIds,
              assignerName: currentUser.name,
              siteUrl: window.location.origin,
              actionType: 'delete' 
            }
          }).catch(err => console.error("Error invoking notify-new-task:", err));
        }
      }

      await supabase.from('tasks').delete().eq('id', id);
      await fetchData();
      if (selectedDayTasksDate) {
         const remainingTasksForDate = tasks.filter(t => t.id !== id && isDateInTaskRange(selectedDayTasksDate, t.date, t.end_date));
         if(remainingTasksForDate.length <= 1) setSelectedDayTasksDate(null);
      }
      showModal('สำเร็จ', 'ลบกิจกรรมเรียบร้อยแล้ว', 'success');
    });
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      showModal('ข้อมูลไม่ครบ', 'กรุณากรอก Username และ Password ให้ครบถ้วน', 'error');
      return;
    }
    
    const hashedPassword = await hashPassword(loginForm.password);
    const user = staffList.find(s => s.username === loginForm.username && s.password === hashedPassword);
    
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('schoolTaskUser', JSON.stringify(user));
      setIsLoginModalOpen(false);
      setLoginForm({ username: '', password: '' });
      setShowPassword(false);
      showModal('ยินดีต้อนรับ', `เข้าสู่ระบบสำเร็จ คุณ ${user.name}`, 'success');
    } else {
      showModal('เข้าสู่ระบบล้มเหลว', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
  };

  const handleLogout = () => {
    showModal('ยืนยันการออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', 'confirm', () => {
      setCurrentUser(null);
      setListFilter('all');
      localStorage.removeItem('schoolTaskUser');
      if(activeTab === 'staff' || activeTab === 'departments') setActiveTab('calendar');
    });
  };

  const handleSaveStaff = async () => {
    if (!newStaff.name || !newStaff.username) return;
    if (!editingStaffId && !newStaff.password) return; 
    
    try {
      const staffData = {
        name: newStaff.name,
        department: newStaff.department,
        role: newStaff.role,
        username: newStaff.username
      };

      if (newStaff.password) {
        staffData.password = await hashPassword(newStaff.password);
      }

      if (editingStaffId) {
        await supabase.from('staff').update(staffData).eq('id', editingStaffId);
      } else {
        await supabase.from('staff').insert([staffData]);
      }
      
      await fetchData();
      setIsStaffModalOpen(false);
      setEditingStaffId(null);
      setNewStaff({ name: '', department: '', role: 'staff', username: '', password: '' });
      showModal('สำเร็จ', 'บันทึกข้อมูลบุคลากรเรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('Error saving staff:', error);
      showModal('ข้อผิดพลาด', 'บันทึกไม่สำเร็จ อาจมี Username ซ้ำในระบบ', 'error');
    }
  };

  const handleDeleteStaff = (id) => {
    showModal('ยืนยันการลบบัญชี', 'คุณต้องการลบรายชื่อนี้ใช่หรือไม่? บัญชีนี้จะไม่สามารถเข้าสู่ระบบได้อีก', 'confirm', async () => {
      await supabase.from('staff').delete().eq('id', id);
      await fetchData();
      showModal('สำเร็จ', 'ลบข้อมูลบุคลากรเรียบร้อยแล้ว', 'success');
    });
  };

  const openNewTaskModal = () => {
    setEditingTaskId(null);
    setNewTask({ title: '', department: '', description: '', date: '', end_date: '', time: '', location: '', assignees: [] });
    setIsModalOpen(true);
  };

  const handleDayClick = (day) => {
    if(!day) return;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = tasks.filter(t => isDateInTaskRange(dateStr, t.date, t.end_date));
    if (dayTasks.length > 0) {
      setSelectedDayTasksDate(dateStr);
    } else if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
       setNewTask({ title: '', department: '', description: '', date: dateStr, end_date: '', time: '', location: '', assignees: [] });
       setIsModalOpen(true);
    }
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNamesThai = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  
  const calendarSlots = useMemo(() => {
    const slots = {};
    const dInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    
    for (let day = 1; day <= dInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      slots[dateStr] = [];
    }

    const monthTasks = tasks.filter(t => {
      for (let day = 1; day <= dInMonth; day++) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (isDateInTaskRange(dateStr, t.date, t.end_date)) return true;
      }
      return false;
    }).sort(compareTasks);

    monthTasks.forEach(task => {
      let slot = 0;
      let found = false;
      const taskDates = [];
      for (let day = 1; day <= dInMonth; day++) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (isDateInTaskRange(dateStr, task.date, task.end_date)) {
          taskDates.push(dateStr);
        }
      }

      while (!found) {
        let canFit = true;
        for (const dateStr of taskDates) {
          if (slots[dateStr][slot] !== undefined && slots[dateStr][slot] !== null) {
            canFit = false;
            break;
          }
        }
        if (canFit) {
          found = true;
        } else {
          slot++;
        }
      }

      for (const dateStr of taskDates) {
        while (slots[dateStr].length <= slot) {
          slots[dateStr].push(null);
        }
        slots[dateStr][slot] = task;
      }
    });

    return slots;
  }, [tasks, currentDate]);

  const generateCalendarDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getTasksForDate = (day) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => isDateInTaskRange(dateStr, t.date, t.end_date));
  };

  const getRoleLabel = (role) => {
     switch(role) {
        case 'admin': return 'ผู้ดูแลระบบ';
        case 'manager': return 'หัวหน้าฝ่ายงาน';
        default: return 'ครูและบุคลากร';
     }
  };

  const renderPagination = (currentPage, totalItems, onPageChange) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t border-gray-200 sm:px-6 rounded-b-2xl">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              แสดง <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> ถึง <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> จากทั้งหมด <span className="font-medium">{totalItems}</span> รายการ
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pages.map(page => (
                <button key={page} onClick={() => onPageChange(page)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${currentPage === page ? 'z-10 bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </div>
        <div className="flex flex-1 justify-between sm:hidden items-center">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">ก่อนหน้า</button>
          <span className="text-sm text-gray-700 font-medium">หน้า {currentPage} / {totalPages}</span>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">ถัดไป</button>
        </div>
      </div>
    );
  };

  if (loading || isLineVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-['IBM_Plex_Sans_Thai']">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-4 mb-4 ${isLineVerifying ? 'border-[#06C755]' : 'border-blue-600'}`}></div>
        <p className="text-gray-600 font-medium">
          {isLineVerifying ? 'กำลังดำเนินการผูกบัญชี LINE ของคุณ...' : 'กำลังเชื่อมต่อฐานข้อมูล...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 relative font-['IBM_Plex_Sans_Thai'] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              <Sprout className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-gray-800 tracking-tight hidden sm:block">ระบบปฏิทินปฏิบัติงานโรงเรียน</h1>
          </div>
          <div className="flex items-center gap-3">
            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
              <button 
                onClick={openNewTaskModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">มอบหมายกิจกรรมใหม่</span>
              </button>
            )}
            
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-gray-200">
                <div className="relative" ref={notifRef}>
                  <button 
                    onClick={handleToggleNotif}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                    )}
                  </button>
                  
                  {isNotifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 flex flex-col">
                      <div className="p-3 border-b border-gray-100 bg-gray-50 font-bold text-sm text-gray-800 flex justify-between items-center shrink-0">
                        กิจกรรมที่ต้องเข้าร่วม
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{myPendingTasks.length}</span>
                      </div>
                      
                      <div className="max-h-80 overflow-y-auto custom-scrollbar flex-1">
                        {paginatedNotifs.length === 0 ? (
                           <div className="p-4 text-center text-sm text-gray-500">ไม่มีกิจกรรมที่กำลังจะมาถึง</div>
                        ) : (
                           paginatedNotifs.map(task => {
                             const isToday = isDateInTaskRange(todayStr, task.date, task.end_date);
                             const isTomorrow = isDateInTaskRange(tomorrowStr, task.date, task.end_date);
                             
                             return (
                             <div key={task.id} className={`p-3 border-b border-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer ${isToday ? 'bg-red-50/30' : isTomorrow ? 'bg-orange-50/30' : ''}`} onClick={() => { setIsNotifOpen(false); setSelectedDayTasksDate(task.date); setActiveTab('calendar'); }}>
                                <div className="text-sm font-semibold text-gray-800 mb-1 flex items-center justify-between">
                                  <span className="truncate">{task.title}</span>
                                  {isToday && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">วันนี้</span>}
                                  {isTomorrow && !isToday && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">พรุ่งนี้</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                  <div className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {formatTaskDateRange(task.date, task.end_date)}</div>
                                  {task.time && <div className="flex items-center gap-1"><Clock className="w-3 h-3"/> {formatTimeThai(task.time)}</div>}
                                </div>
                             </div>
                           )})
                        )}
                      </div>

                      {totalNotifPages > 1 && (
                        <div className="p-2 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs shrink-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentPageNotif(prev => Math.max(1, prev - 1)); }}
                            disabled={currentPageNotif === 1}
                            className="px-2 py-1.5 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <span className="text-gray-500 font-medium">หน้า {currentPageNotif} / {totalNotifPages}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentPageNotif(prev => Math.min(totalNotifPages, prev + 1)); }}
                            disabled={currentPageNotif === totalNotifPages}
                            className="px-2 py-1.5 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Profile Dropdown */}
                <div className="relative ml-1" ref={profileRef}>
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
                  >
                    {currentUser.line_picture_url ? (
                      <img src={currentUser.line_picture_url} alt="Profile" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm">
                        {getInitials(currentUser.name)}
                      </div>
                    )}
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
                      <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-blue-50/50 to-white flex flex-col items-center text-center">
                         {currentUser.line_picture_url ? (
                            <img src={currentUser.line_picture_url} alt="Profile" className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md mb-3" />
                         ) : (
                            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold border-4 border-white shadow-md mb-3">
                              {getInitials(currentUser.name)}
                            </div>
                         )}
                         <span className="text-base font-bold text-gray-900">{currentUser.name}</span>
                         <span className="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full mt-1.5">
                           {getRoleLabel(currentUser.role)}
                         </span>
                      </div>

                      <div className="p-2">
                        <div className="p-1">
                          {currentUser.line_user_id ? (
                            <button 
                              onClick={handleLineDisconnect}
                              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors border border-red-100"
                            >
                              <Link2Off className="w-4 h-4" /> ยกเลิกการเชื่อมต่อ LINE
                            </button>
                          ) : (
                            <button 
                              onClick={handleLineConnect} 
                              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-[#06C755] hover:bg-[#05b34c] px-3 py-2.5 rounded-xl transition-colors shadow-sm"
                            >
                              <Link2 className="w-4 h-4" /> เชื่อมต่อ LINE รับแจ้งเตือน
                            </button>
                          )}
                        </div>

                        <div className="h-px bg-gray-100 my-1 mx-2"></div>

                        <div className="p-1">
                          <button 
                            onClick={() => { setIsProfileOpen(false); handleLogout(); }} 
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                          >
                            <LogOut className="w-4 h-4" /> ออกจากระบบ
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={() => { setIsLoginModalOpen(true); setShowPassword(false); }} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                <Lock className="w-4 h-4" /> เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-grow w-full">
        
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-fit overflow-x-auto max-w-full">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'calendar' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Calendar className="w-4 h-4" /> ปฏิทินปฏิบัติงาน
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'list' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List className="w-4 h-4" /> รายการกิจกรรม
          </button>
          {currentUser?.role === 'admin' && (
            <>
              <button 
                onClick={() => setActiveTab('staff')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'staff' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Users className="w-4 h-4" /> จัดการบุคลากร
              </button>
              <button 
                onClick={() => setActiveTab('departments')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'departments' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Layers className="w-4 h-4" /> จัดการฝ่าย
              </button>
            </>
          )}
        </div>

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Calendar Header */}
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between bg-gray-50/50 gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 w-48 text-center">
                  {monthNamesThai[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
                </h2>
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                เดือนปัจจุบัน
              </button>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-100">
              {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((day, idx) => (
                <div key={day} className={`py-2 text-center text-xs sm:text-sm font-semibold ${idx === 0 || idx === 6 ? 'text-red-500' : 'text-gray-600'}`}>
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 bg-gray-200 gap-px">
              {generateCalendarDays().map((day, index) => {
                const dayTasks = getTasksForDate(day);
                const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                
                return (
                  <div 
                    key={index} 
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[100px] sm:min-h-[120px] bg-white flex flex-col ${!day ? 'bg-gray-50/50' : 'hover:bg-blue-50/50 transition-colors cursor-pointer'}`}
                  >
                    {day && (
                      <>
                        <div className="flex justify-between items-start mb-1 pt-1.5 sm:pt-2 px-1.5 sm:px-2">
                          <span className={`text-xs sm:text-sm font-semibold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                            {day}
                          </span>
                          {dayTasks.length > 0 && (
                            <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md hidden sm:inline-block">{dayTasks.length} กิจกรรม</span>
                          )}
                        </div>
                        
                        {/* Task Dots for Mobile */}
                        <div className="flex flex-wrap gap-1 sm:hidden mt-1 px-1.5">
                           {dayTasks.map((task, i) => i < 3 && (
                             <div key={task.id} className="w-2 h-2 rounded-full bg-blue-500"></div>
                           ))}
                           {dayTasks.length > 3 && <span className="text-[8px] text-gray-400">+{dayTasks.length-3}</span>}
                        </div>

                        {/* Task List for Desktop */}
                        <div className="hidden sm:flex flex-1 overflow-y-auto custom-scrollbar flex-col pt-1 overflow-x-hidden">
                          {(() => {
                            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const slottedTasks = calendarSlots[dateStr] || [];
                            
                            return slottedTasks.map((task, slotIndex) => {
                              if (!task) {
                                return <div key={`empty-${slotIndex}`} className="h-[26px] mb-1.5 w-full shrink-0"></div>;
                              }
                              
                              const isTaskStart = task.date === dateStr;
                              const isTaskEnd = !task.end_date || task.end_date === dateStr;
                              const isWeekStart = index % 7 === 0;
                              const isWeekEnd = index % 7 === 6;

                              const connectLeft = !isTaskStart && !isWeekStart;
                              const connectRight = !isTaskEnd && !isWeekEnd;

                              let wrapperClasses = "h-[26px] text-[10.5px] transition-opacity truncate font-medium flex items-center justify-between shrink-0 relative cursor-pointer ";
                              
                              if (connectLeft && connectRight) {
                                wrapperClasses += "rounded-none border-y border-blue-200 bg-blue-100/80 text-blue-800 border-x-0 mb-1.5 pl-2";
                              } else if (connectLeft) {
                                wrapperClasses += "rounded-r-md border-y border-r border-blue-200 bg-blue-100/80 text-blue-800 border-l-0 mb-1.5 mr-1.5 sm:mr-2 pl-2";
                              } else if (connectRight) {
                                wrapperClasses += "rounded-l-md border-y border-l border-blue-200 bg-blue-50 text-blue-700 border-r-0 shadow-sm mb-1.5 ml-1.5 sm:ml-2 pl-2";
                              } else {
                                wrapperClasses += "rounded-md border border-blue-200 bg-blue-50 text-blue-700 mb-1.5 shadow-sm mx-1.5 sm:mx-2 pl-2";
                              }

                              const showTitle = isTaskStart || isWeekStart;

                              return (
                                <div 
                                  key={`${task.id}-${dateStr}`} 
                                  className={wrapperClasses} 
                                  title={task.title}
                                >
                                  {showTitle ? (
                                    <>
                                      <span className="truncate flex-1">{task.title}</span>
                                      {task.time && isTaskStart && <span className="flex-shrink-0 ml-1 opacity-70 text-[9px]">{task.time.substring(0,5)}</span>}
                                    </>
                                  ) : (
                                    <span>&nbsp;</span>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Task List Tab (รายการกิจกรรม) */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">
                {listFilter === 'mine' ? 'กิจกรรมของฉัน' : 'รายการกิจกรรมทั้งหมด'}
              </h2>
              {currentUser && (
                <div className="flex bg-gray-200/70 p-1 rounded-xl w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={() => { setListFilter('all'); setCurrentPageTasks(1); }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${listFilter === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ทั้งหมด
                  </button>
                  <button 
                    onClick={() => { setListFilter('mine'); setCurrentPageTasks(1); }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${listFilter === 'mine' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    กิจกรรมของฉัน
                  </button>
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {displayedListTasks.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">
                   {listFilter === 'mine' ? 'คุณไม่มีกิจกรรมที่ต้องรับผิดชอบในขณะนี้' : 'ไม่มีกิจกรรมในระบบ'}
                 </div>
              ) : displayedListTasks
                   .slice((currentPageTasks - 1) * ITEMS_PER_PAGE, currentPageTasks * ITEMS_PER_PAGE)
                   .map((task) => (
                <div key={task.id} className="p-5 hover:bg-blue-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-base font-bold text-gray-800">{task.title}</h3>
                      {task.department && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {task.department}
                        </span>
                      )}
                    </div>
                    
                    {task.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>}
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                      <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-blue-500" /> {formatTaskDateRange(task.date, task.end_date)}</div>
                      {task.time && <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-400" /> {formatTimeThai(task.time)}</div>}
                      {task.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-400" /> {task.location}</div>}
                    </div>

                    {task.assignees.length > 0 && (
                      <div className="flex items-start gap-2 mt-3">
                        <span className="text-xs text-gray-500 font-medium shrink-0 mt-1.5">ผู้รับผิดชอบ:</span>
                        
                        {task.assignees.length === staffList.length && staffList.length > 0 ? (
                          <div className="mt-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-sm flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> ครูและบุคลากรทั้งหมด
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-y-1.5 pl-2">
                            {task.assignees.map(id => {
                              const staff = staffList.find(s => s.id === id);
                              if (!staff) return null;
                              return (
                                <div key={id} className="relative group -ml-2" onClick={(e) => { e.stopPropagation(); showModal('ข้อมูลผู้รับผิดชอบ', `ชื่อ-สกุล: ${staff.name}\nฝ่าย/แผนก: ${staff.department || '-'}`, 'info'); }}>
                                  {staff.line_picture_url ? (
                                    <img src={staff.line_picture_url} alt={staff.name} className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm cursor-pointer relative group-hover:z-10 group-hover:scale-110 transition-all" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm cursor-pointer relative group-hover:z-10 group-hover:scale-110 transition-all">
                                      {getInitials(staff.name)}
                                    </div>
                                  )}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-gray-800/90 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 backdrop-blur-sm shadow-lg border border-gray-700/50">
                                    {staff.name}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditTask(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="แก้ไข">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="ลบ">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {renderPagination(currentPageTasks, displayedListTasks.length, setCurrentPageTasks)}
          </div>
        )}

        {/* Staff Tab (จัดการบุคลากร - Admin Only) */}
        {activeTab === 'staff' && currentUser?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">จัดการข้อมูลบุคลากร</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ หรือ ฝ่าย..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPageStaff(1); }}
                    className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  />
                </div>
                <button 
                  onClick={() => { 
                    setEditingStaffId(null); 
                    setNewStaff({ name: '', department: '', role: 'staff', username: '', password: '' }); 
                    setShowStaffPassword(false); // ซ่อนรหัสผ่านเมื่อกดปุ่มเพิ่ม
                    setIsStaffModalOpen(true); 
                  }}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium transition-colors shrink-0"
                >
                  <UserPlus className="w-4 h-4" /> เพิ่มบุคลากร
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">ชื่อ-นามสกุล</th>
                    <th className="py-3 px-4 font-semibold">ฝ่าย/แผนก</th>
                    <th className="py-3 px-4 font-semibold">สิทธิ์การใช้งาน</th>
                    <th className="py-3 px-4 font-semibold">ชื่อผู้ใช้งาน (Username)</th>
                    <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredStaff.slice((currentPageStaff - 1) * ITEMS_PER_PAGE, currentPageStaff * ITEMS_PER_PAGE).map((staff) => (
                    <tr key={staff.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {staff.line_picture_url ? (
                            <img src={staff.line_picture_url} alt={staff.name} className="w-8 h-8 rounded-full object-cover border border-blue-200 shadow-sm shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200 shadow-sm shrink-0">
                              {getInitials(staff.name)}
                            </div>
                          )}
                          <span className="font-medium text-gray-800">{staff.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{staff.department || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-1 rounded-md font-medium border ${staff.role === 'admin' ? 'bg-red-50 text-red-700 border-red-100' : staff.role === 'manager' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {getRoleLabel(staff.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700 text-sm font-medium">{staff.username}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { 
                              setEditingStaffId(staff.id); 
                              // ไม่ดึงรหัสผ่านเก่ามาแสดง เพื่อความปลอดภัย และป้องกันการเข้ารหัสซ้ำ
                              setNewStaff({ ...staff, password: '' }); 
                              setShowStaffPassword(false); // ซ่อนรหัสผ่านเมื่อกดแก้ไข
                              setIsStaffModalOpen(true); 
                            }} 
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="แก้ไข"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteStaff(staff.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="ลบ">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStaff.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-500">
                  {staffList.length === 0 ? 'ไม่มีข้อมูลบุคลากรในระบบ' : 'ไม่พบข้อมูลบุคลากรที่ค้นหา'}
                </div>
              )}
            </div>
            {renderPagination(currentPageStaff, filteredStaff.length, setCurrentPageStaff)}
          </div>
        )}

        {/* Department Tab (จัดการฝ่าย - Admin Only) */}
        {activeTab === 'departments' && currentUser?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">จัดการรายชื่อฝ่าย/แผนก</h2>
            </div>
            <div className="p-4 border-b border-gray-100 flex gap-2 bg-white">
              <input 
                type="text" value={newDept} onChange={e => setNewDept(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDept()}
                placeholder="พิมพ์ชื่อฝ่ายใหม่..." 
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <button 
                onClick={handleAddDept} disabled={!newDept.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
              >
                เพิ่มฝ่าย
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold w-16 text-center">ลำดับ</th>
                    <th className="py-3 px-4 font-semibold">ชื่อฝ่าย/แผนก</th>
                    <th className="py-3 px-4 font-semibold text-right w-40">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {departments.slice((currentPageDepts - 1) * ITEMS_PER_PAGE, currentPageDepts * ITEMS_PER_PAGE).map((dept, index) => (
                    <tr key={dept} className="hover:bg-blue-50/30 transition-colors group">
                      {editingDept === dept ? (
                        <>
                          <td className="py-2.5 px-4 text-center text-gray-400 font-medium">{(currentPageDepts - 1) * ITEMS_PER_PAGE + index + 1}</td>
                          <td className="py-2.5 px-4">
                            <input 
                              type="text" value={editDeptInput} onChange={e => setEditDeptInput(e.target.value)}
                              className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                              autoFocus
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <button onClick={() => handleSaveEditDept(dept)} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors mr-2">บันทึก</button>
                            <button onClick={() => setEditingDept(null)} className="text-xs text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">ยกเลิก</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-center text-gray-400 font-medium">{(currentPageDepts - 1) * ITEMS_PER_PAGE + index + 1}</td>
                          <td className="py-3 px-4 font-medium text-gray-800">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                              {dept}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => { setEditingDept(dept); setEditDeptInput(dept); }} 
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="แก้ไข"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteDept(dept)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="ลบ">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {departments.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-500">ไม่มีข้อมูลฝ่ายในระบบ</div>
              )}
            </div>
            {renderPagination(currentPageDepts, departments.length, setCurrentPageDepts)}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center">
           <p className="text-sm text-gray-500 font-medium">Copyright &copy; {new Date().getFullYear()+543} - นายธนาวัฒน์ ประพันธ์</p>
        </div>
      </footer>

      {/* --- Modals (Popups) --- */}

      {/* 1. Daily Tasks Popup Modal (แสดงเมื่อคลิกที่วันที่) */}
      {selectedDayTasksDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh]" style={{ animation: 'slideUpFade 0.2s ease-out' }}>
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> กิจกรรมวันที่ {formatDateThai(selectedDayTasksDate)}
              </h2>
              <button onClick={() => setSelectedDayTasksDate(null)} className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-1 overflow-y-auto custom-scrollbar">
               {tasks.filter(t => isDateInTaskRange(selectedDayTasksDate, t.date, t.end_date)).length === 0 ? (
                 <div className="p-8 text-center text-gray-500">ไม่มีกิจกรรมในวันนี้</div>
               ) : (
                 <div className="divide-y divide-gray-100">
                   {tasks.filter(t => isDateInTaskRange(selectedDayTasksDate, t.date, t.end_date))
                         .sort((a,b) => (a.time || '23:59').localeCompare(b.time || '23:59'))
                         .map(task => (
                     <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                           <div className="flex flex-wrap items-center gap-2">
                             <h3 className="font-bold text-gray-800 text-sm">{task.title}</h3>
                             {task.department && (
                               <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                 {task.department}
                               </span>
                             )}
                           </div>
                        </div>
                        {task.description && <p className="text-xs text-gray-600 mb-3">{task.description}</p>}
                        
                        <div className="flex flex-col gap-2">
                           <div className="flex flex-wrap gap-4">
                             <div className="text-xs text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-blue-500" /> วันที่: {formatTaskDateRange(task.date, task.end_date)}</div>
                             {task.time && <div className="text-xs text-gray-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-400" /> เวลา: {formatTimeThai(task.time)}</div>}
                             {task.location && <div className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-400" /> สถานที่: {task.location}</div>}
                           </div>
                           
                           {task.assignees.length > 0 && (
                             <div className="flex items-start gap-2 mt-2">
                               <div className="flex items-center gap-1.5 shrink-0 mt-1.5">
                                 <Users className="w-3.5 h-3.5 text-blue-500" />
                                 <span className="text-xs text-gray-500 font-medium">ผู้รับผิดชอบ:</span>
                               </div>
                               
                               {task.assignees.length === staffList.length && staffList.length > 0 ? (
                                 <div className="mt-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-sm flex items-center gap-1.5">
                                   ครูและบุคลากรทั้งหมด
                                 </div>
                               ) : (
                                 <div className="flex flex-wrap gap-y-1.5 pl-2">
                                   {task.assignees.map(id => {
                                     const staff = staffList.find(s => s.id === id);
                                     if (!staff) return null;
                                     return (
                                       <div key={id} className="relative group -ml-2" onClick={(e) => { e.stopPropagation(); showModal('ข้อมูลผู้รับผิดชอบ', `ชื่อ-สกุล: ${staff.name}\nฝ่าย/แผนก: ${staff.department || '-'}`, 'info'); }}>
                                         {staff.line_picture_url ? (
                                           <img src={staff.line_picture_url} alt={staff.name} className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm cursor-pointer relative group-hover:z-10 group-hover:scale-110 transition-all" />
                                         ) : (
                                           <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm cursor-pointer relative group-hover:z-10 group-hover:scale-110 transition-all">
                                             {getInitials(staff.name)}
                                           </div>
                                         )}
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-gray-800/90 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 backdrop-blur-sm shadow-lg border border-gray-700/50">
                                           {staff.name}
                                         </div>
                                       </div>
                                     );
                                   })}
                                 </div>
                               )}
                             </div>
                           )}
                        </div>

                        {/* Admin/Manager controls inside Day Modal */}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                           <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
                              <button onClick={() => { setSelectedDayTasksDate(null); handleEditTask(task); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                <Edit className="w-3 h-3"/> แก้ไข
                              </button>
                              <button onClick={() => handleDeleteTask(task.id)} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                                <Trash2 className="w-3 h-3"/> ลบ
                              </button>
                           </div>
                        )}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Create/Edit Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-visible flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {editingTaskId ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />} 
                {editingTaskId ? 'แก้ไขกิจกรรม' : 'มอบหมายกิจกรรมใหม่'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อกิจกรรม <span className="text-red-500">*</span></label>
                <input 
                  type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm"
                  placeholder="เช่น ประชุมครูประจำเดือน"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">รายละเอียดกิจกรรม</label>
                <textarea 
                  value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[80px] resize-none transition-all shadow-sm"
                  placeholder="เพิ่มคำอธิบายหรือสิ่งที่ต้องเตรียม..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">วันที่เริ่มต้น <span className="text-red-500">*</span></label>
                  <input 
                    type="date" value={newTask.date} onChange={e => setNewTask({...newTask, date: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ถึงวันที่ (กรณีจัดหลายวัน)</label>
                  <input 
                    type="date" min={newTask.date} value={newTask.end_date || ''} onChange={e => setNewTask({...newTask, end_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">เวลา (24 ชม.)</label>
                  <input 
                    type="time" 
                    lang="en-GB"
                    value={newTask.time} 
                    onChange={e => setNewTask({...newTask, time: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ฝ่าย/งานที่รับผิดชอบ</label>
                  <div className="relative">
                    <select 
                      value={newTask.department} onChange={e => setNewTask({...newTask, department: e.target.value})}
                      className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm bg-white hover:border-blue-400 cursor-pointer text-gray-700"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">สถานที่</label>
                <input 
                  type="text" value={newTask.location} onChange={e => setNewTask({...newTask, location: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm"
                  placeholder="เช่น ห้องประชุม 1"
                />
              </div>

              {/* Custom Tagify-like Input for Assignees */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ผู้รับผิดชอบ (เลือกได้หลายคน)</label>
                
                {/* Simulated Input Box */}
                <div 
                  className="w-full border border-gray-300 rounded-xl p-1.5 min-h-[46px] bg-white flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-sm"
                  onClick={() => setIsDropdownOpen(true)}
                >
                  {/* Selected Tags */}
                  {newTask.assignees.map(id => {
                    const staff = staffList.find(s => s.id === id);
                    if (!staff) return null;
                    return (
                      <span key={id} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                        {staff.name}
                        <button 
                          onClick={(e) => removeAssignee(e, id)}
                          className="hover:bg-blue-200 rounded-full p-0.5 text-blue-500 hover:text-blue-800 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  
                  {/* Search Input Trigger */}
                  <div className="flex-1 min-w-[100px]">
                    <input
                      type="text"
                      readOnly
                      placeholder={newTask.assignees.length === 0 ? "คลิกเพื่อเลือกผู้รับผิดชอบ..." : ""}
                      className="w-full bg-transparent border-none outline-none text-sm py-1 px-2 cursor-pointer text-gray-500"
                    />
                  </div>
                </div>

                {/* Pop-up Dropdown (Opens Upwards) */}
                {isDropdownOpen && (
                  <div 
                    ref={dropdownRef}
                    className="absolute bottom-full left-0 w-full mb-2 bg-white border border-gray-200 rounded-xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1),0_0_5px_rgba(0,0,0,0.05)] z-50 overflow-hidden flex flex-col transform transition-all opacity-100 translate-y-0"
                    style={{ animation: 'slideUpFade 0.2s ease-out' }}
                  >
                    <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="พิมพ์ค้นหารายชื่อ หรือ แผนก..."
                        className="bg-transparent border-none outline-none text-sm w-full font-medium"
                      />
                    </div>
                    
                    <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
                      
                      {/* ปุ่มเลือกทั้งหมด */}
                      <div 
                        onClick={handleToggleAllAssignees}
                        className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group border-b border-gray-100 mb-1"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${newTask.assignees.length === staffList.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                          {newTask.assignees.length === staffList.length && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">เลือกทั้งหมด (บุคลากรทุกคน)</span>
                        </div>
                      </div>

                      {filteredStaff.length === 0 ? (
                        <div className="p-3 text-center text-sm text-gray-500">ไม่พบรายชื่อที่ค้นหา</div>
                      ) : (
                        filteredStaff.map(staff => {
                          const isSelected = newTask.assignees.includes(staff.id);
                          return (
                            <div 
                              key={staff.id}
                              onClick={() => toggleAssignee(staff.id)}
                              className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200">
                                {getInitials(staff.name)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-800">{staff.name}</span>
                                <span className="text-[10px] text-gray-500">{staff.department}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveTask}
                disabled={!newTask.title || !newTask.date}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                บันทึกกิจกรรม
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* 3. Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden" style={{ animation: 'slideUpFade 0.2s ease-out' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <LogIn className="w-5 h-5 text-blue-600" /> เข้าสู่ระบบ
              </h2>
              <button onClick={() => setIsLoginModalOpen(false)} className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
                <input type="text" autoComplete="off" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" placeholder="กรอกชื่อผู้ใช้..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">รหัสผ่าน</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={loginForm.password} 
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} 
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" 
                    placeholder="กรอกรหัสผ่าน..." 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsLoginModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button onClick={handleLogin} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">เข้าสู่ระบบ</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Staff Management Modal (Admin Only) */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden my-auto" style={{ animation: 'slideUpFade 0.2s ease-out' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                {editingStaffId ? <Edit className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />} 
                {editingStaffId ? 'แก้ไขข้อมูลบัญชีบุคลากร' : 'เพิ่มบัญชีบุคลากรใหม่'}
              </h2>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อ-สกุล <span className="text-red-500">*</span></label>
                <input type="text" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" placeholder="เช่น ครูใจดี มีสุข" />
              </div>
                 <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1.5">ฝ่าย/แผนก</label>
                   <div className="relative">
                     <select 
                       value={newStaff.department} onChange={e => setNewStaff({...newStaff, department: e.target.value})} 
                       className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all bg-white hover:border-blue-400 cursor-pointer text-gray-700"
                     >
                       <option value="">-- เลือกฝ่าย --</option>
                       {departments.map(dept => (
                         <option key={dept} value={dept}>{dept}</option>
                       ))}
                     </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                       <ChevronDown className="w-4 h-4" />
                     </div>
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1.5">สิทธิ์การใช้งาน <span className="text-red-500">*</span></label>
                   <div className="relative">
                     <select 
                       value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} 
                       className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white hover:border-blue-400 cursor-pointer text-gray-700"
                     >
                        <option value="staff">ครูและบุคลากร</option>
                        <option value="manager">หัวหน้าฝ่ายงาน</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                     </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                       <ChevronDown className="w-4 h-4" />
                     </div>
                   </div>
                 </div>
              
              <div className="border-t border-gray-200 pt-4 mt-2">
                 <h3 className="text-sm font-bold text-blue-800 mb-3">ข้อมูลสำหรับการเข้าสู่ระบบ</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username <span className="text-red-500">*</span></label>
                      <input type="text" autoComplete="off" value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all bg-blue-50/30" placeholder="เช่น kru.jaidee" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password {!editingStaffId && <span className="text-red-500">*</span>}</label>
                      <div className="relative">
                        <input 
                          type={showStaffPassword ? "text" : "password"} 
                          autoComplete="new-password" 
                          value={newStaff.password || ''} 
                          onChange={e => setNewStaff({...newStaff, password: e.target.value})} 
                          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all bg-blue-50/30" 
                          placeholder={editingStaffId ? "เว้นว่างไว้หากไม่เปลี่ยน" : "ตั้งรหัสผ่าน"} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowStaffPassword(!showStaffPassword)}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setIsStaffModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button onClick={handleSaveStaff} disabled={!newStaff.name || !newStaff.username || (!editingStaffId && !newStaff.password)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm">บันทึกข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Custom Notification Modal (แทนที่ alert และ confirm) */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ animation: 'slideUpFade 0.2s ease-out' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" style={{ animation: 'zoomIn 0.2s ease-out' }}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full shrink-0 ${
                modal.type === 'success' ? 'bg-green-100 text-green-600' : 
                modal.type === 'error' ? 'bg-red-100 text-red-600' : 
                modal.type === 'confirm' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {modal.type === 'success' && <CheckCircle className="w-6 h-6" />}
                {modal.type === 'error' && <AlertCircle className="w-6 h-6" />}
                {modal.type === 'confirm' && <HelpCircle className="w-6 h-6" />}
                {modal.type === 'info' && <Info className="w-6 h-6" />}
              </div>
              <div className="mt-1">
                <h3 className="text-lg font-bold text-gray-900">{modal.title}</h3>
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-line leading-relaxed">{modal.message}</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              {modal.type === 'confirm' ? (
                <>
                  <button onClick={closeModal} className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">
                    ยกเลิก
                  </button>
                  <button onClick={handleModalConfirm} className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm">
                    ยืนยัน
                  </button>
                </>
              ) : (
                <button onClick={closeModal} className={`w-full py-2.5 px-4 font-medium rounded-xl transition-colors text-white shadow-sm ${
                  modal.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 
                  modal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                  ตกลง
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}