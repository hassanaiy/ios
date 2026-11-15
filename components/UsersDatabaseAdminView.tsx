import React, { useState, useMemo } from 'react';
import { User, Driver, UserRole } from '../types';
import {
  adminPurgeUserCompletely,
  PurgeUserSummary,
  updateUserProfile,
  checkIsAdmin
} from '../services/firebaseBridge';

interface UsersDatabaseAdminViewProps {
  users: (User | Driver)[];
  isRTL?: boolean;
  onInspectDriverDocs?: (driver: Driver) => void;
}

export const UsersDatabaseAdminView: React.FC<UsersDatabaseAdminViewProps> = ({
  users,
  isRTL = false,
  onInspectDriverDocs
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | 'passengers' | 'drivers' | 'pending' | 'banned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Delete / Purge Modal State
  const [userToPurge, setUserToPurge] = useState<(User | Driver) | null>(null);
  const [bulkPurgeConfirmOpen, setBulkPurgeConfirmOpen] = useState(false);
  const [purgeRelatedRecords, setPurgeRelatedRecords] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<(User | Driver) | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    phone: string;
    email: string;
    role: UserRole;
    walletBalance: number;
    pendingFees: number;
    rewardPoints: number;
    status: string;
    isBanned: boolean;
    vehicleBrand: string;
    vehicleModel: string;
    vehiclePlate: string;
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isDriverRecord = (u: any) => {
    return (
      u.role === UserRole.DRIVER ||
      Boolean(u.vehiclePlate || u.licenseUrl || u.documents?.licenseFront)
    );
  };

  const isPendingRecord = (u: any) => {
    return (
      u.status === 'pending' ||
      u.driverStatus === 'pending' ||
      u.kycStatus === 'PENDING_REVIEW' ||
      u.hasPendingDriverApplication === true
    );
  };

  // Summary Counts
  const counts = useMemo(() => {
    const total = users.length;
    const driversCount = users.filter(isDriverRecord).length;
    const passengersCount = users.filter((u) => !isDriverRecord(u) && u.role !== UserRole.ADMIN).length;
    const pendingCount = users.filter(isPendingRecord).length;
    const bannedCount = users.filter(
      (u) => u.isBanned || (u as any).status === 'deactivated' || ((u as any).suspendedUntil ?? 0) > Date.now()
    ).length;
    return { total, driversCount, passengersCount, pendingCount, bannedCount };
  }, [users]);

  // Filtered & Sorted Users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (roleFilter === 'drivers' && !isDriverRecord(u)) return false;
        if (roleFilter === 'passengers' && (isDriverRecord(u) || u.role === UserRole.ADMIN)) return false;
        if (roleFilter === 'pending' && !isPendingRecord(u)) return false;
        if (
          roleFilter === 'banned' &&
          !u.isBanned &&
          (u as any).status !== 'deactivated' &&
          ((u as any).suspendedUntil ?? 0) <= Date.now()
        ) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const d = u as Driver;
          const matchName = (u.name || '').toLowerCase().includes(q);
          const matchPhone = (u.phone || '').toLowerCase().includes(q);
          const matchEmail = (u.email || '').toLowerCase().includes(q);
          const matchId = (u.id || '').toLowerCase().includes(q);
          const matchPlate = (d.vehiclePlate || '').toLowerCase().includes(q);
          const matchModel = `${d.vehicleBrand || ''} ${d.vehicleModel || ''}`.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchEmail && !matchId && !matchPlate && !matchModel) {
            return false;
          }
        }
        return true;
      })
      .sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const timeB = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
        return timeB - timeA;
      });
  }, [users, roleFilter, searchQuery]);

  const toggleSelectUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAllFiltered = () => {
    const deletableIds = filteredUsers
      .filter((u) => !checkIsAdmin(u.email, u.phone))
      .map((u) => u.id);
    if (selectedUserIds.length === deletableIds.length && deletableIds.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(deletableIds);
    }
  };

  const handleOpenEditUser = (u: User | Driver) => {
    const d = u as Driver;
    setEditingUser(u);
    setEditForm({
      name: u.name || '',
      phone: u.phone || '',
      email: u.email || '',
      role: u.role || UserRole.PASSENGER,
      walletBalance: Number(u.walletBalance || 0),
      pendingFees: Number(d.pendingFees || 0),
      rewardPoints: Number(u.rewardPoints || 0),
      status: u.status || 'approved',
      isBanned: Boolean(u.isBanned),
      vehicleBrand: d.vehicleBrand || '',
      vehicleModel: d.vehicleModel || '',
      vehiclePlate: d.vehiclePlate || ''
    });
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser || !editForm) return;
    setIsSavingEdit(true);
    try {
      await updateUserProfile(editingUser.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        walletBalance: Number(editForm.walletBalance),
        pendingFees: Number(editForm.pendingFees),
        rewardPoints: Number(editForm.rewardPoints),
        status: editForm.status as any,
        isApproved: editForm.status === 'approved',
        isBanned: editForm.isBanned,
        ...(editForm.role === UserRole.DRIVER
          ? {
              vehicleBrand: editForm.vehicleBrand.trim(),
              vehicleModel: editForm.vehicleModel.trim(),
              vehiclePlate: editForm.vehiclePlate.trim()
            }
          : {})
      } as any);

      setStatusMessage({
        type: 'success',
        text: isRTL
          ? `تم تحديث بيانات المستخدم (${editForm.name}) بنجاح.`
          : `Updated user profile (${editForm.name}) successfully.`
      });
      setEditingUser(null);
      setEditForm(null);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: isRTL
          ? `فشل تحديث بيانات المستخدم: ${err?.message || ''}`
          : `Failed to update user profile: ${err?.message || ''}`
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmSinglePurge = async () => {
    if (!userToPurge) return;
    setIsPurging(true);
    setStatusMessage(null);
    try {
      const summary: PurgeUserSummary = await adminPurgeUserCompletely(userToPurge.id, {
        purgeRelatedRecords
      });
      setSelectedUserIds((prev) => prev.filter((id) => id !== userToPurge.id));
      setStatusMessage({
        type: 'success',
        text: isRTL
          ? `تم الحذف النهائي الشامل للمستخدم (${userToPurge.name} - ${userToPurge.phone}) وإلغاء حساب المصادقة (Auth) وحذف (${summary.deletedRides} رحلات، ${summary.deletedTickets} تذاكر دعم).`
          : `Permanently deleted user (${userToPurge.name} - ${userToPurge.phone}), revoked Auth account, and purged (${summary.deletedRides} rides, ${summary.deletedTickets} support tickets).`
      });
      setUserToPurge(null);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: isRTL
          ? `حدث خطأ أثناء حذف المستخدم: ${err?.message || ''}`
          : `Error purging user: ${err?.message || ''}`
      });
    } finally {
      setIsPurging(false);
    }
  };

  const handleConfirmBulkPurge = async () => {
    if (selectedUserIds.length === 0) return;
    setIsPurging(true);
    setStatusMessage(null);
    try {
      let count = 0;
      for (const uid of selectedUserIds) {
        const target = users.find((u) => u.id === uid);
        if (target && checkIsAdmin(target.email, target.phone)) continue;
        await adminPurgeUserCompletely(uid, { purgeRelatedRecords });
        count++;
      }
      setSelectedUserIds([]);
      setBulkPurgeConfirmOpen(false);
      setStatusMessage({
        type: 'success',
        text: isRTL
          ? `تم الحذف النهائي الشامل لعدد (${count}) مستخدمين مع حسابات المصادقة (Auth) وجميع بياناتهم.`
          : `Permanently purged ${count} users along with their Auth accounts and database records.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: isRTL
          ? `حدث خطأ أثناء الحذف الجماعي: ${err?.message || ''}`
          : `Bulk purge failed: ${err?.message || ''}`
      });
    } finally {
      setIsPurging(false);
    }
  };

  const handleExportUsersJson = () => {
    const blob = new Blob([JSON.stringify(filteredUsers, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mowasla_users_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatJoinDate = (ts: any) => {
    if (!ts) return '---';
    const ms = ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
    if (!ms || isNaN(ms)) return '---';
    return new Date(ms).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fas ${
                statusMessage.type === 'success'
                  ? 'fa-check-circle text-emerald-600'
                  : 'fa-exclamation-circle text-red-600'
              } text-base`}
            ></i>
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-gray-700 px-2"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Top KPI Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            id: 'all',
            label: isRTL ? 'إجمالي المستخدمين' : 'Total Users',
            count: counts.total,
            icon: 'fa-users',
            activeClass: 'bg-gray-900 text-white border-gray-900',
            iconClass: 'bg-gray-100 text-gray-700'
          },
          {
            id: 'passengers',
            label: isRTL ? 'الركاب (Passengers)' : 'Passengers',
            count: counts.passengersCount,
            icon: 'fa-user',
            activeClass: 'bg-blue-600 text-white border-blue-600',
            iconClass: 'bg-blue-50 text-blue-600'
          },
          {
            id: 'drivers',
            label: isRTL ? 'الكباتن (Drivers)' : 'Drivers',
            count: counts.driversCount,
            icon: 'fa-user-tie',
            activeClass: 'bg-indigo-600 text-white border-indigo-600',
            iconClass: 'bg-indigo-50 text-indigo-600'
          },
          {
            id: 'pending',
            label: isRTL ? 'قيد المراجعة' : 'Pending Review',
            count: counts.pendingCount,
            icon: 'fa-id-card',
            activeClass: 'bg-amber-500 text-gray-950 border-amber-500',
            iconClass: 'bg-amber-50 text-amber-600'
          },
          {
            id: 'banned',
            label: isRTL ? 'المحظورين / الموقوفين' : 'Banned / Inactive',
            count: counts.bannedCount,
            icon: 'fa-ban',
            activeClass: 'bg-red-600 text-white border-red-600',
            iconClass: 'bg-red-50 text-red-600'
          }
        ].map((card) => {
          const active = roleFilter === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setRoleFilter(card.id as any)}
              className={`p-4 rounded-3xl border text-start transition-all flex items-center justify-between ${
                active
                  ? `${card.activeClass} shadow-lg`
                  : 'bg-white text-gray-900 border-gray-100 hover:border-gray-300 shadow-xs'
              }`}
            >
              <div>
                <p className={`text-[11px] font-bold ${active ? 'opacity-80' : 'text-gray-500'}`}>
                  {card.label}
                </p>
                <p className="text-2xl font-black mt-1">{card.count}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm ${
                  active ? 'bg-white/20 text-current' : card.iconClass
                }`}
              >
                <i className={`fas ${card.icon}`}></i>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search, Bulk Actions & Table Card */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50/40">
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <i className="fas fa-users-cog text-blue-600"></i>
              {isRTL
                ? 'قاعدة بيانات المستخدمين الشاملة والتحكم الكامل في الحسابات'
                : 'Complete Users Database & Full Account Purge Control'}
            </h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              {isRTL
                ? 'عرض وتعديل بيانات أي مستخدم (راكب أو كابتن) أو حذف حسابه نهائياً من المصادقة (Auth) وقاعدة البيانات بالكامل.'
                : 'Inspect, edit, or permanently purge any user account from Firebase Auth and all Firestore collections.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[260px] flex-1 sm:flex-initial">
              <i className="fas fa-search absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isRTL
                    ? 'بحث بالاسم، الهاتف، الإيميل، المعرف UID، اللوحة...'
                    : 'Search name, phone, email, UID, plate...'
                }
                className="w-full bg-white border border-gray-200 rounded-xl ps-9 pe-8 py-2 text-xs font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            {selectedUserIds.length > 0 && (
              <button
                onClick={() => setBulkPurgeConfirmOpen(true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-red-600/20"
              >
                <i className="fas fa-user-slash"></i>
                {isRTL
                  ? `حذف نهائي للمحددين (${selectedUserIds.length})`
                  : `Purge Selected (${selectedUserIds.length})`}
              </button>
            )}

            <button
              onClick={handleExportUsersJson}
              className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-all flex items-center gap-2"
            >
              <i className="fas fa-download text-[#FFC90E]"></i>
              {isRTL ? 'تصدير JSON' : 'Export JSON'}
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredUsers.length > 0 &&
                      selectedUserIds.length ===
                        filteredUsers.filter((u) => !checkIsAdmin(u.email, u.phone)).length
                    }
                    onChange={toggleSelectAllFiltered}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-start">
                  {isRTL ? 'المستخدم والنوع' : 'User & Role'}
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-start">
                  {isRTL ? 'الهاتف والبريد الإلكتروني' : 'Phone & Email'}
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-start">
                  {isRTL ? 'المعرف (Auth UID)' : 'Auth UID'}
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-start">
                  {isRTL ? 'المحفظة والمديونية' : 'Wallet & Fees'}
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-start">
                  {isRTL ? 'الحالة والتسجيل' : 'Status & Joined'}
                </th>
                <th className="px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-end">
                  {isRTL ? 'تحكم كامل وحذف نهائي' : 'Full Control & Purge'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-bold text-sm">
                    {isRTL ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No matching users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const d = u as Driver;
                  const isDriver = isDriverRecord(u);
                  const isAdminAccount = checkIsAdmin(u.email, u.phone);
                  const isSelected = selectedUserIds.includes(u.id);

                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-red-50/40' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        {!isAdminAccount && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUser(u.id)}
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        )}
                      </td>

                      {/* User & Role */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img
                              src={
                                u.avatar ||
                                d.personalPhotoUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  u.name || 'U'
                                )}&background=${isDriver ? '1D4ED8' : 'FFC90E'}&color=${
                                  isDriver ? 'fff' : '000'
                                }`
                              }
                              alt={u.name}
                              className="w-11 h-11 rounded-2xl object-cover border border-gray-200"
                            />
                            {d.isOnline && (
                              <span className="absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-gray-900 truncate flex items-center gap-1.5">
                              <span>{u.name || (isRTL ? 'بدون اسم' : 'Unnamed')}</span>
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 mt-0.5">
                              {isAdminAccount ? (
                                <span className="text-purple-600">
                                  {isRTL ? 'مدير النظام (Admin)' : 'System Admin'}
                                </span>
                              ) : isDriver ? (
                                <span className="text-blue-600">
                                  {isRTL ? 'كابتن (Driver)' : 'Driver'}
                                  {d.vehiclePlate ? ` • ${d.vehiclePlate}` : ''}
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  {isRTL ? 'راكب (Passenger)' : 'Passenger'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Email */}
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs font-black text-gray-800" dir="ltr">
                          {u.phone || '---'}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate max-w-[180px]" dir="ltr">
                          {u.email || '---'}
                        </div>
                      </td>

                      {/* Auth UID */}
                      <td className="px-4 py-4">
                        <span
                          className="font-mono text-[11px] text-gray-600 bg-gray-100 px-2 py-1 rounded-lg select-all"
                          dir="ltr"
                        >
                          {u.id}
                        </span>
                      </td>

                      {/* Wallet & Fees */}
                      <td className="px-4 py-4">
                        <div className="text-xs font-black text-gray-900">
                          {isRTL ? 'المحفظة:' : 'Wallet:'} {u.walletBalance || 0} EGP
                        </div>
                        {isDriver && (
                          <div className="text-[11px] font-bold text-red-600 mt-0.5">
                            {isRTL ? 'المديونية:' : 'Fees:'} {d.pendingFees || 0} EGP
                          </div>
                        )}
                      </td>

                      {/* Status & Join Date */}
                      <td className="px-4 py-4">
                        <div className="text-xs font-black">
                          {u.isBanned ? (
                            <span className="text-red-600">{isRTL ? 'محظور (Banned)' : 'Banned'}</span>
                          ) : isPendingRecord(u) ? (
                            <span className="text-amber-600">
                              {isRTL ? 'قيد المراجعة' : 'Pending Review'}
                            </span>
                          ) : (
                            <span className="text-emerald-600">{isRTL ? 'نشط (Active)' : 'Active'}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {formatJoinDate(u.createdAt)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isDriver && onInspectDriverDocs && (
                            <button
                              onClick={() => onInspectDriverDocs(d)}
                              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-black transition-colors"
                              title={isRTL ? 'مراجعة الوثائق' : 'Inspect Documents'}
                            >
                              <i className="fas fa-id-card me-1"></i>
                              {isRTL ? 'الوثائق' : 'Docs'}
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 text-xs font-black transition-colors flex items-center gap-1.5"
                          >
                            <i className="fas fa-edit"></i>
                            {isRTL ? 'تعديل' : 'Edit'}
                          </button>

                          {!isAdminAccount && (
                            <button
                              onClick={() => {
                                setUserToPurge(u);
                                setPurgeRelatedRecords(true);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 text-xs font-black transition-all flex items-center gap-1.5"
                              title={
                                isRTL
                                  ? 'حذف نهائي شامل للحساب والمصادقة وكافة البيانات'
                                  : 'Permanently delete user Auth & all database records'
                              }
                            >
                              <i className="fas fa-trash-alt"></i>
                              {isRTL ? 'حذف نهائي' : 'Total Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single User Total Purge Confirmation Modal */}
      {userToPurge && (
        <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl shrink-0">
                <i className="fas fa-user-times"></i>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {isRTL ? 'حذف نهائي شامل للمستخدم' : 'Total User Auth & Database Purge'}
                </h3>
                <p className="text-xs text-red-600 font-bold">
                  {isRTL
                    ? 'هذا الإجراء نهائي ولا يمكن التراجع عنه'
                    : 'This action is permanent and cannot be undone'}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">{isRTL ? 'الاسم:' : 'Name:'}</span>
                <span className="font-black text-gray-900">{userToPurge.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">{isRTL ? 'الهاتف:' : 'Phone:'}</span>
                <span className="font-mono font-black text-gray-900" dir="ltr">
                  {userToPurge.phone}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">{isRTL ? 'المعرف (UID):' : 'Auth UID:'}</span>
                <span className="font-mono text-[11px] text-gray-600" dir="ltr">
                  {userToPurge.id}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-gray-600">
              <p className="font-black text-gray-800">
                {isRTL ? 'سيتم مسح وإلغاء كل مما يلي:' : 'The following will be completely erased:'}
              </p>
              <ul className="space-y-1.5 ps-2">
                <li className="flex items-center gap-2">
                  <i className="fas fa-check text-red-500"></i>
                  <span>
                    {isRTL
                      ? 'حساب تسجيل الدخول والمصادقة (Firebase Auth) وإغلاق جميع الجلسات'
                      : 'Firebase Authentication account & active device sessions'}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fas fa-check text-red-500"></i>
                  <span>
                    {isRTL
                      ? 'ملف المستخدم بالكامل والوثائق والأماكن المحفوظة (users/{uid})'
                      : 'Complete user profile, documents, and saved places (users/{uid})'}
                  </span>
                </li>
              </ul>

              <label className="mt-3 flex items-center gap-2.5 p-3 rounded-xl bg-red-50/70 border border-red-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeRelatedRecords}
                  onChange={(e) => setPurgeRelatedRecords(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                />
                <span className="text-xs font-bold text-red-900">
                  {isRTL
                    ? 'حذف جميع السجلات المرتبطة أيضاً (الرحلات، المحادثات، تذاكر الدعم، طلبات الشحن، التسويات)'
                    : 'Also purge all linked records (Rides, Support Tickets, Direct Chats, Top-ups, Settlements)'}
                </span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setUserToPurge(null)}
                disabled={isPurging}
                className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black transition-colors"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmSinglePurge}
                disabled={isPurging}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
              >
                {isPurging ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>{isRTL ? 'جاري المسح الشامل...' : 'Purging...'}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash-alt"></i>
                    <span>{isRTL ? 'تأكيد الحذف النهائي الشامل' : 'Confirm Total Purge'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Purge Confirmation Modal */}
      {bulkPurgeConfirmOpen && (
        <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl shrink-0">
                <i className="fas fa-users-slash"></i>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {isRTL
                    ? `حذف جماعي نهائي لعدد (${selectedUserIds.length}) مستخدمين`
                    : `Bulk Purge ${selectedUserIds.length} Users`}
                </h3>
                <p className="text-xs text-red-600 font-bold">
                  {isRTL
                    ? 'سيتم مسح حسابات المصادقة وجميع بياناتهم نهائياً'
                    : 'All selected Auth accounts and database records will be erased'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setBulkPurgeConfirmOpen(false)}
                disabled={isPurging}
                className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmBulkPurge}
                disabled={isPurging}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-2"
              >
                {isPurging ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <i className="fas fa-trash-alt"></i>
                    <span>{isRTL ? 'تأكيد الحذف الجماعي' : 'Confirm Bulk Purge'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Details Modal */}
      {editingUser && editForm && (
        <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {isRTL ? 'تعديل بيانات الحساب' : 'Edit User Account Details'}
                </h3>
                <p className="text-xs font-mono text-gray-400">UID: {editingUser.id}</p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setEditForm(null);
                }}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'نوع الحساب (Role)' : 'User Role'}
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900"
                >
                  <option value={UserRole.PASSENGER}>
                    {isRTL ? 'راكب (PASSENGER)' : 'PASSENGER'}
                  </option>
                  <option value={UserRole.DRIVER}>{isRTL ? 'كابتن (DRIVER)' : 'DRIVER'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'رصيد المحفظة (EGP)' : 'Wallet Balance (EGP)'}
                </label>
                <input
                  type="number"
                  value={editForm.walletBalance}
                  onChange={(e) =>
                    setEditForm({ ...editForm, walletBalance: Number(e.target.value) })
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'مديونية الكابتن (Pending Fees)' : 'Pending Fees (EGP)'}
                </label>
                <input
                  type="number"
                  value={editForm.pendingFees}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pendingFees: Number(e.target.value) })
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-500 uppercase mb-1">
                  {isRTL ? 'حالة الحساب' : 'Account Status'}
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900"
                >
                  <option value="approved">{isRTL ? 'مفعل (Approved)' : 'Approved'}</option>
                  <option value="pending">{isRTL ? 'قيد المراجعة (Pending)' : 'Pending'}</option>
                  <option value="rejected">{isRTL ? 'مرفوض (Rejected)' : 'Rejected'}</option>
                  <option value="deactivated">{isRTL ? 'موقوف (Deactivated)' : 'Deactivated'}</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isBanned}
                    onChange={(e) => setEditForm({ ...editForm, isBanned: e.target.checked })}
                    className="w-4 h-4 rounded text-red-600"
                  />
                  <span className="text-xs font-black text-red-600">
                    {isRTL ? 'حظر هذا المستخدم (Banned)' : 'Ban User Account'}
                  </span>
                </label>
              </div>
            </div>

            {editForm.role === UserRole.DRIVER && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                    {isRTL ? 'ماركة السيارة' : 'Vehicle Brand'}
                  </label>
                  <input
                    type="text"
                    value={editForm.vehicleBrand}
                    onChange={(e) => setEditForm({ ...editForm, vehicleBrand: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                    {isRTL ? 'موديل السيارة' : 'Vehicle Model'}
                  </label>
                  <input
                    type="text"
                    value={editForm.vehicleModel}
                    onChange={(e) => setEditForm({ ...editForm, vehicleModel: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                    {isRTL ? 'رقم اللوحة' : 'License Plate'}
                  </label>
                  <input
                    type="text"
                    value={editForm.vehiclePlate}
                    onChange={(e) => setEditForm({ ...editForm, vehiclePlate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  setEditingUser(null);
                  setEditForm(null);
                }}
                className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveUserEdit}
                disabled={isSavingEdit}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-600/20"
              >
                {isSavingEdit
                  ? isRTL
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : isRTL
                  ? 'حفظ التعديلات'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
