import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { scheduleAPI, Schedule, Seat } from '../services/api';
import { useAuthStore } from '../store/authStore';
import PageHeader from '../components/PageHeader';

/**
 * 选座页面组件
 *
 * 功能说明：
 * 1. 人数选择：支持1-6人，点击人数按钮切换
 * 2. 智能推荐：根据人数推荐相邻座位（优先同行连续，其次距银幕中央最近）
 * 3. 手动选座：点击座位图中的可选座位进行选择
 * 4. 锁座确认：选好座位后点击「确认选座」锁定，防止其他用户同时选择
 * 5. 锁座有效期10分钟，超时自动释放
 *
 * 座位状态说明：
 * - 可选（灰色）：available=true, sold=false, locked=false
 * - 已选（绿色）：当前用户选中的座位
 * - 已售（深灰）：sold=true，不可点击
 * - 已锁（橙色）：locked=true 且被其他用户锁定，不可点击
 */
export default function SeatSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 从URL参数获取初始票数
  const initialTicketCount = parseInt(searchParams.get('tickets') || '1', 10);
  // 当前登录用户（用于判断锁座归属）
  const user = useAuthStore(state => state.user);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  // 当前选中的座位ID列表
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  // 当前选择的观影人数
  const [ticketCount, setTicketCount] = useState(initialTicketCount);
  const [loading, setLoading] = useState(true);
  // 推荐座位加载状态
  const [recommending, setRecommending] = useState(false);
  // 锁座加载状态
  const [locking, setLocking] = useState(false);
  // 是否已锁定当前选中的座位（锁定后不可修改选择，需先解锁）
  const [seatsLocked, setSeatsLocked] = useState(false);
  // 标记是否正在导航到支付页面
  // 导航到支付页时不解锁座位，保持锁座状态直到订单创建
  // 仅在用户主动离开（非前往支付）时才解锁
  const navigatingToPayment = useRef(false);

  // 获取排片信息（含最新座位状态）
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!id) return;
      try {
        const res = await scheduleAPI.getSchedule(id);
        setSchedule(res.data);
      } catch (error) {
        console.error('获取排片信息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [id]);

  // 组件卸载时释放锁座
  // 关键：仅在非导航到支付页时解锁
  // 导航到支付页时座位必须保持锁定状态，否则：
  // 1. 其他用户可以选到已锁的座位（待支付座位被他人选中）
  // 2. 创建订单时后端校验锁座状态失败（锁座已过期错误）
  useEffect(() => {
    return () => {
      if (id && seatsLocked && !navigatingToPayment.current) {
        scheduleAPI.unlockSeats(id).catch(() => {});
      }
    };
  }, [id, seatsLocked]);

  // 页面离开前释放锁座（浏览器刷新/关闭等场景）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (id && seatsLocked) {
        const token = useAuthStore.getState().token;
        // 使用 sendBeacon 保证请求在页面关闭前能发出
        navigator.sendBeacon(
          `/api/schedules/${id}/lock`,
          JSON.stringify({ _method: 'DELETE' })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id, seatsLocked]);

  /**
   * 判断座位是否可选
   *
   * 可选条件：
   * 1. 座位存在且可用（available=true）
   * 2. 座位未被售出（sold=false）
   * 3. 座位未被其他用户锁定（locked=false 或 locked_by=当前用户）
   */
  const isSeatSelectable = useCallback((seatId: string): boolean => {
    if (!schedule?.seats[seatId]) return false;
    const seat: Seat = schedule.seats[seatId];
    if (!seat.available || seat.sold) return false;
    // 如果座位被锁定，只有锁定者是当前用户才可选
    if (seat.locked && seat.locked_by !== user?.id) return false;
    return true;
  }, [schedule, user]);

  /**
   * 点击座位进行选择/取消选择
   *
   * 规则：
   * - 已锁定的座位不可修改（需先点击「重新选座」解锁）
   * - 取消选择：如果座位已在选中列表中，移除
   * - 添加选择：如果未超过票数限制，添加到选中列表
   */
  const toggleSeat = (seatId: string) => {
    if (!isSeatSelectable(seatId)) return;
    // 锁定状态下不允许修改选择
    if (seatsLocked) {
      alert('座位已锁定，如需修改请先点击"重新选座"');
      return;
    }

    setSelectedSeats(prev => {
      if (prev.includes(seatId)) {
        // 取消选择
        return prev.filter(s => s !== seatId);
      }
      // 检查是否超过票数限制
      if (prev.length >= ticketCount) {
        alert(`您已选择 ${ticketCount} 个座位，如需修改请先取消已选座位`);
        return prev;
      }
      // 添加选择
      return [...prev, seatId];
    });
  };

  /**
   * 根据人数推荐座位
   *
   * 调用后端推荐算法，优先推荐同行相邻座位
   * 推荐成功后自动填入选中列表
   */
  const handleRecommend = async () => {
    if (!id) return;
    setRecommending(true);
    try {
      const res = await scheduleAPI.recommendSeats(id, ticketCount);
      const recommended = res.data.recommended;
      if (recommended.length === 0) {
        alert('抱歉，当前没有足够的相邻座位可供推荐');
        return;
      }
      // 如果之前已锁定，先解锁再重新选择
      if (seatsLocked) {
        await scheduleAPI.unlockSeats(id);
        setSeatsLocked(false);
      }
      setSelectedSeats(recommended);
      // 刷新座位状态
      const scheduleRes = await scheduleAPI.getSchedule(id);
      setSchedule(scheduleRes.data);
    } catch (error: any) {
      alert(error.response?.data?.message || '推荐座位失败，请重试');
    } finally {
      setRecommending(false);
    }
  };

  /**
   * 锁定已选座位
   *
   * 锁定后其他用户无法选择这些座位，有效期10分钟
   * 同一用户同一场次只能有一组锁座，新锁座会自动释放旧锁
   */
  const handleLockSeats = async () => {
    if (!id || selectedSeats.length !== ticketCount) return;
    setLocking(true);
    try {
      await scheduleAPI.lockSeats(id, selectedSeats);
      setSeatsLocked(true);
      // 刷新座位状态以显示锁定效果
      const res = await scheduleAPI.getSchedule(id);
      setSchedule(res.data);
    } catch (error: any) {
      alert(error.response?.data?.message || '锁座失败，请重新选择');
      // 锁座失败时刷新座位状态并清空选择
      const res = await scheduleAPI.getSchedule(id);
      setSchedule(res.data);
      setSelectedSeats([]);
      setSeatsLocked(false);
    } finally {
      setLocking(false);
    }
  };

  /**
   * 重新选座
   * 解锁当前锁定的座位，清空选择列表，允许重新选择
   */
  const handleReselect = async () => {
    if (!id) return;
    try {
      await scheduleAPI.unlockSeats(id);
      setSeatsLocked(false);
      setSelectedSeats([]);
      // 刷新座位状态
      const res = await scheduleAPI.getSchedule(id);
      setSchedule(res.data);
    } catch (error) {
      console.error('解锁失败:', error);
    }
  };

  /**
   * 进入支付页面
   * 前提：座位已锁定且选满
   * 导航前设置标记，防止组件卸载时自动解锁座位
   */
  const handleNext = () => {
    if (selectedSeats.length !== ticketCount) {
      alert(`请选择 ${ticketCount} 个座位`);
      return;
    }
    if (!seatsLocked) {
      alert('请先确认并锁定座位');
      return;
    }
    if (!id) return;

    // 标记正在导航到支付页，防止卸载时解锁
    navigatingToPayment.current = true;

    const seatsParam = encodeURIComponent(JSON.stringify(selectedSeats));
    navigate(`/schedules/${id}/payment?seats=${seatsParam}`);
  };

  /**
   * 修改人数
   * 修改人数后需要清空已选座位并解锁（如果已锁定）
   */
  const handleTicketCountChange = async (newCount: number) => {
    if (newCount === ticketCount) return;
    // 如果已锁定座位，先解锁
    if (seatsLocked && id) {
      try {
        await scheduleAPI.unlockSeats(id);
        setSeatsLocked(false);
        const res = await scheduleAPI.getSchedule(id);
        setSchedule(res.data);
      } catch (error) {
        console.error('解锁失败:', error);
      }
    }
    setTicketCount(newCount);
    setSelectedSeats([]);
  };

  /**
   * 渲染座位图
   *
   * 座位状态与样式映射：
   * - seat-available（灰色）：可选座位
   * - seat-selected（绿色）：当前用户选中的座位
   * - seat-sold（深灰）：已售出，不可点击
   * - seat-locked（橙色）：被其他用户锁定，不可点击
   */
  const renderSeats = () => {
    if (!schedule) return null;

    const rows = 8;
    const cols = 12;
    const seats = [];

    for (let r = 0; r < rows; r++) {
      const rowSeats = [];
      for (let c = 0; c < cols; c++) {
        const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
        const seat = schedule.seats[seatId];
        const isSelected = selectedSeats.includes(seatId);
        const isSold = seat?.sold;
        // 被其他用户锁定的座位
        const isLockedByOther = seat?.locked && seat?.locked_by !== user?.id;
        // 被当前用户锁定的座位（已确认锁定状态）
        const isLockedByMe = seat?.locked && seat?.locked_by === user?.id;

        // 确定座位样式类名
        let seatClass = 'seat-available';
        if (isSold) {
          seatClass = 'seat-sold';
        } else if (isSelected || isLockedByMe) {
          seatClass = 'seat-selected';
        } else if (isLockedByOther) {
          seatClass = 'seat-locked';
        }

        // 座位是否可点击（已售和被他人锁定的座位不可点击）
        const canClick = !isSold && !isLockedByOther;

        rowSeats.push(
          <button
            key={seatId}
            onClick={() => toggleSeat(seatId)}
            disabled={!canClick}
            className={seatClass}
            title={
              isSold ? `${seatId} 已售` :
              isLockedByOther ? `${seatId} 已被锁定` :
              isSelected ? `${seatId} 已选` :
              `${seatId} 可选`
            }
          />
        );
      }

      seats.push(
        <div key={r} className="flex items-center justify-center gap-1">
          <span className="w-6 text-center text-xs text-gray-400">{String.fromCharCode(65 + r)}</span>
          <div className="flex gap-1">{rowSeats}</div>
          <span className="w-6 text-center text-xs text-gray-400">{String.fromCharCode(65 + r)}</span>
        </div>
      );
    }

    return seats;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">😢</div>
        <p>排片不存在</p>
      </div>
    );
  }

  const totalPrice = selectedSeats.length * schedule.price;
  // 还需选择的座位数
  const remainingSeats = ticketCount - selectedSeats.length;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-24">
      <PageHeader
        title="选择座位"
        subtitle={schedule ? `${schedule.movie_title} · ${schedule.hall}` : '请选择座位'}
      />

      {/* 电影信息卡片 */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex gap-4">
          <img
            src={schedule.poster}
            alt={schedule.movie_title}
            className="w-24 h-36 object-cover rounded-lg"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold">{schedule.movie_title}</h2>
            <p className="text-gray-500 mt-2">
              📍 {schedule.cinema_name}
            </p>
            <p className="text-gray-500 mt-1">
              🕒 {schedule.start_time} · {schedule.hall}
            </p>
            <p className="text-gray-500 mt-1">
              ⏱️ {schedule.duration}分钟 · 屏幕方向：银幕中央
            </p>
            <div className="flex items-center gap-4 mt-2">
              <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-sm font-medium">
                👥 {ticketCount} 张票
              </span>
              <span className={`text-sm ${remainingSeats > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                {remainingSeats > 0 ? `还需选择 ${remainingSeats} 个座位` : '已选满，可继续'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 人数选择与推荐区域 */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          {/* 人数选择器：1-6人，选中后决定需要选几个座位 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">观影人数</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map(count => (
                <button
                  key={count}
                  onClick={() => handleTicketCountChange(count)}
                  disabled={seatsLocked}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    ticketCount === count
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${seatsLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* 推荐座位按钮：锁定状态下不可推荐 */}
          <button
            onClick={handleRecommend}
            disabled={recommending || seatsLocked}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              recommending || seatsLocked
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/30'
            }`}
          >
            {recommending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                推荐中...
              </>
            ) : (
              <>🎯 智能推荐</>
            )}
          </button>
        </div>
      </div>

      {/* 座位图 */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        {/* 银幕指示 */}
        <div className="flex justify-center mb-2">
          <div className="w-3/4 h-8 bg-gradient-to-b from-gray-300 to-gray-100 rounded-b-full flex items-center justify-center text-xs text-gray-500">
            银 幕
          </div>
        </div>

        {/* 列号 */}
        <div className="flex justify-center my-6 text-sm">
          <div className="flex gap-1">{Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="w-7 text-center text-gray-400">{i + 1}</span>
          ))}</div>
        </div>

        {/* 座位网格 */}
        <div className="space-y-2">{renderSeats()}</div>

        {/* 座位图例 */}
        <div className="flex justify-center gap-6 mt-8 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-200"></div>
            <span className="text-sm text-gray-600">可选</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-green-500"></div>
            <span className="text-sm text-gray-600">已选</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-gray-400"></div>
            <span className="text-sm text-gray-600">已售</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-t-lg bg-orange-400"></div>
            <span className="text-sm text-gray-600">已锁</span>
          </div>
        </div>
      </div>

      {/* 底部操作栏（固定在底部） */}
      <div className="bg-white rounded-xl p-4 shadow-sm sticky bottom-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">已选 {selectedSeats.length} / {ticketCount} 个座位</p>
            {selectedSeats.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                座位：{selectedSeats.sort().join('、')}
              </p>
            )}
            {seatsLocked && (
              <p className="text-xs text-orange-500 mt-1">🔒 座位已锁定，请尽快完成支付</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-gray-500">合计</p>
              <p className="text-2xl font-bold text-red-500">¥{totalPrice}</p>
            </div>
            {/* 根据锁定状态显示不同操作按钮 */}
            {!seatsLocked ? (
              // 未锁定：显示「确认选座」按钮
              <button
                onClick={handleLockSeats}
                disabled={selectedSeats.length !== ticketCount || locking}
                className={`px-6 py-3.5 rounded-xl font-medium transition-all ${
                  selectedSeats.length === ticketCount && !locking
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {locking ? '锁定中...' : '确认选座'}
              </button>
            ) : (
              // 已锁定：显示「重新选座」和「下一步·支付」按钮
              <>
                <button
                  onClick={handleReselect}
                  className="px-4 py-3.5 rounded-xl font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  重新选座
                </button>
                <button
                  onClick={handleNext}
                  className="px-6 py-3.5 rounded-xl font-medium bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 transition-all"
                >
                  下一步 · 支付
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
