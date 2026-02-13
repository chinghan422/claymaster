
import React, { useRef, useState } from 'react';
import { Participant, Round, QuestionPoolItem, Submission } from '../types';

interface ParticipantDashboardProps {
  participant: Participant;
  activeRound: Round | undefined;
  submissions: Submission[];
  questionPool: QuestionPoolItem[];
  onUploadToPool: (imageUrl: string) => void;
  onUploadSubmission: (imageUrl: string) => void;
  onDeleteFromPool: (itemId: string) => void;
  onLogout: () => void;
  onImageClick: (url: string, title: string) => void;
}

export const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({
  participant,
  activeRound,
  submissions,
  questionPool,
  onUploadToPool,
  onUploadSubmission,
  onDeleteFromPool,
  onLogout,
  onImageClick
}) => {
  const poolFileRef = useRef<HTMLInputElement>(null);
  const submissionFileRef = useRef<HTMLInputElement>(null);

  const myPoolItems = questionPool.filter(q => q.contributorId === participant.id);
  const myAllSubmissions = submissions.filter(s => s.participantId === participant.id && s.imageUrl !== '');

  const myCurrentSubmission = activeRound
    ? submissions.find(s => s.roundId === activeRound.id && s.participantId === participant.id)
    : null;

  const handlePoolFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onUploadToPool(reader.result as string);
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleSubmissionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onUploadSubmission(reader.result as string);
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-amber-950">選手工作台</h2>
      </div>

      {/* 題庫照片上傳區：最多 3 張 */}
      <div className="clay-card p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-black text-amber-950 text-lg flex items-center gap-2">
              <span>📷</span> 我貢獻的題目
            </h3>
            <p className="text-[11px] text-amber-600 font-bold uppercase tracking-widest mt-1">My Contributions ({myPoolItems.length}/3)</p>
          </div>
          {myPoolItems.length < 3 && (
            <button
              onClick={() => poolFileRef.current?.click()}
              className="bg-amber-900 text-white text-xs px-5 py-2.5 rounded-xl font-black hover:bg-black transition-all shadow-md active:scale-95"
            >
              + 上傳照片
            </button>
          )}
        </div>

        <input type="file" accept="image/*" className="hidden" ref={poolFileRef} onChange={handlePoolFile} />

        {myPoolItems.length === 0 ? (
          <div className="border-4 border-dashed border-amber-50 rounded-[32px] p-12 text-center bg-amber-50/10">
            <p className="text-sm text-amber-600 font-bold mb-6">尚未上傳任何題目照片...</p>
            <button
              onClick={() => poolFileRef.current?.click()}
              className="px-8 py-4 bg-white border-2 border-amber-300 text-amber-800 rounded-2xl font-black shadow-lg hover:bg-amber-50 transition-all active:scale-95"
            >
              上傳照片
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {myPoolItems.map((item) => (
              <div key={item.id} className="relative group">
                <div className="aspect-square bg-white rounded-3xl border-2 border-amber-50 overflow-hidden shadow-sm transition-all group-hover:shadow-md">
                  <img
                    src={item.imageUrl}
                    className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-110"
                    alt="my photo"
                    onClick={() => onImageClick(item.imageUrl, '我貢獻的題目')}
                  />
                </div>
                <button
                  onClick={() => onDeleteFromPool(item.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full text-xs flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  ✕
                </button>
              </div>
            ))}
            {[...Array(3 - myPoolItems.length)].map((_, i) => (
              <div key={i} className="aspect-square border-4 border-dashed border-amber-50 rounded-3xl flex items-center justify-center text-amber-50 text-3xl font-black cursor-pointer hover:border-amber-200 hover:text-amber-400 transition-colors"
                   onClick={() => poolFileRef.current?.click()}>
                +
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 現場賽事資訊 */}
      {activeRound && (
        <div className="clay-card p-8 border-l-8 border-amber-500 bg-amber-50/10 shadow-xl space-y-8">
          <h3 className="font-black text-amber-900 text-xl flex items-center gap-3">
             <span className="flex h-3 w-3 rounded-full bg-red-500 animate-ping"></span>
             即時戰況：Round {activeRound.roundNumber} 挑戰中
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-[32px] shadow-inner border border-amber-100 cursor-pointer group transition-all hover:shadow-lg"
                 onClick={() => activeRound.isTopicRevealed && onImageClick(activeRound.topicImage, `當前挑戰題目`)}>
              <p className="text-[11px] text-amber-600 font-black mb-3 uppercase tracking-[0.3em] text-center">當前回合題目 (點擊放大)</p>
              {activeRound.isTopicRevealed ? (
                <img src={activeRound.topicImage} className="w-full h-48 object-contain rounded-lg transition-transform group-hover:scale-105" alt="題目" />
              ) : (
                <div className="w-full h-48 bg-amber-50 animate-pulse rounded-2xl flex flex-col items-center justify-center text-amber-400">
                  <span className="text-6xl font-black">?</span>
                  <p className="text-[11px] mt-4 font-black">等待揭曉...</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-inner border border-emerald-100 flex flex-col justify-center items-center text-center">
              <p className="text-[11px] text-emerald-500 font-black mb-3 uppercase tracking-[0.3em]">我的參賽作品</p>
              {myCurrentSubmission?.imageUrl ? (
                <div className="w-full space-y-4">
                  <img
                    src={myCurrentSubmission.imageUrl}
                    className="w-full h-40 object-contain rounded-xl border-2 border-emerald-50 cursor-pointer hover:opacity-80 transition-opacity"
                    alt="my work"
                    onClick={() => onImageClick(myCurrentSubmission.imageUrl, '我的黏土作品')}
                  />
                  <button
                    onClick={() => submissionFileRef.current?.click()}
                    className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100"
                  >
                    重新上傳作品
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-full h-32 border-2 border-dashed border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-200">
                    <span className="text-4xl">📸</span>
                  </div>
                  <button
                    disabled={!activeRound.isTopicRevealed}
                    onClick={() => submissionFileRef.current?.click()}
                    className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 ${activeRound.isTopicRevealed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'}`}
                  >
                    {activeRound.isTopicRevealed ? '📷 上傳黏土作品' : '等題目揭曉後上傳'}
                  </button>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" ref={submissionFileRef} onChange={handleSubmissionFile} />
            </div>
          </div>

          <p className="text-center text-sm text-amber-800 font-black">
             {activeRound.isTopicRevealed ? "「題目已公開，作品上傳後觀眾即可開始評分！」" : "「管理員正在準備揭曉本次比賽主題...」"}
          </p>
        </div>
      )}
    </div>
  );
};
