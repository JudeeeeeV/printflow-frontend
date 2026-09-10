import React, { useState, useEffect } from 'react';
import { Save } from '@carbon/icons-react';
import { apiClient } from '../../services/apiClient';

export const ShopSettingsPage: React.FC = () => {
 const [shopName, setShopName] = useState('');
 const [address, setAddress] = useState('');
 const [description, setDescription] = useState('');
 const [isSaving, setIsSaving] = useState(false);
 const [message, setMessage] = useState('');

 useEffect(() => {
 const fetchShop = async () => {
 try {
 const data = await apiClient<any>('/shops/me', { method: 'GET' });
 if (data) {
 setShopName(data.name || '');
 setAddress(data.location || '');
 setDescription(data.description || '');
 }
 } catch (err) {
 console.error("Failed to fetch shop settings:", err);
 }
 };
 fetchShop();
 }, []);

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsSaving(true);
 setMessage('');
 try {
 await apiClient('/shops/me', {
 method: 'PATCH',
 body: JSON.stringify({
 name: shopName,
 location: address,
 description: description
 })
 });
 setMessage('Settings saved successfully!');
 // To ensure the sidebar name updates without a full reload, 
 // the user can see it next time or we could implement a context, but a reload is easiest for now:
 window.location.reload();
 } catch (err: any) {
 setMessage(err.message || 'Failed to save settings.');
 } finally {
 setIsSaving(false);
 }
 };

 return (
 <div className="p-8 font-sans max-w-2xl">
 <h1 className="text-2xl font-bold text-carbon-gray-100 mb-6">Shop Settings</h1>
 
 {message && (
 <div className={`mb-4 p-4 text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-carbon-gray-100'}`}>
 {message}
 </div>
 )}

 <form onSubmit={handleSave} className="bg-white border border-[#e0e0e0] p-6 space-y-6">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Print Shop Name</label>
 <input 
 type="text" 
 value={shopName}
 onChange={(e) => setShopName(e.target.value)}
 className="w-full border border-[#8d8d8d] px-3 py-2 text-sm focus:outline-none focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60" 
 required
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Location / Address</label>
 <input 
 type="text" 
 value={address}
 onChange={(e) => setAddress(e.target.value)}
 className="w-full border border-[#8d8d8d] px-3 py-2 text-sm focus:outline-none focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60" 
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
 <textarea 
 rows={4}
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="w-full border border-[#8d8d8d] px-3 py-2 text-sm focus:outline-none focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60" 
 />
 </div>

 <div className="pt-4 flex justify-end">
 <button disabled={isSaving} type="submit" className="flex items-center space-x-2 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white px-4 py-2 font-medium text-sm transition-colors disabled:opacity-50">
 <Save className="w-4 h-4" />
 <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
 </button>
 </div>
 </form>
 </div>
 );
};
