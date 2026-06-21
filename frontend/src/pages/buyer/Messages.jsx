import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getConversations, getConversation, sendMessage, pollMessages } from '../../api/messages';
import { formatRelativeTime } from '../../utils/formatPrice';
import useAuthStore from '../../stores/authStore';
import Loader from '../../components/shared/Loader';
import EmptyState from '../../components/shared/EmptyState';
import { Send } from 'lucide-react';

const Messages = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(searchParams.get('conv') || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const lastTimestamp = useRef(new Date().toISOString());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    getConversations()
      .then((res) => setConversations(res.data.data.conversations))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    getConversation(activeConv).then((res) => {
      setMessages(res.data.data.messages);
      lastTimestamp.current = new Date().toISOString();
    });
  }, [activeConv]);

  // Polling toutes les 10s
  useEffect(() => {
    if (!activeConv) return;
    const interval = setInterval(async () => {
      try {
        const res = await pollMessages(activeConv, lastTimestamp.current);
        if (res.data.data.messages.length > 0) {
          setMessages((prev) => [...prev, ...res.data.data.messages]);
          lastTimestamp.current = res.data.data.timestamp;
        }
      } catch (e) {}
    }, 10000);
    return () => clearInterval(interval);
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      await sendMessage(activeConv, input);
      setMessages((prev) => [...prev, {
        id: Date.now(), sender_id: user.id, content: input, type: 'text', created_at: new Date().toISOString(),
      }]);
      setInput('');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Loader text="Chargement des messages..." />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 h-[calc(100vh-140px)] flex gap-4">
      {/* Liste conversations */}
      <div className="w-full md:w-72 bg-white rounded-xl border border-gray-100 overflow-y-auto flex-shrink-0">
        {conversations.length === 0 ? (
          <EmptyState icon="💬" title="Aucune conversation" />
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConv(conv.id)}
              className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-[#F7F3EE] transition ${
                activeConv === conv.id ? 'bg-[#D6EAE0]' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-[#1A1A18]">
                  {user.role === 'buyer' ? conv.shop_name : conv.buyer_name}
                </p>
                {conv.unread > 0 && (
                  <span className="bg-[#F4A100] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {conv.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">{conv.last_message}</p>
              <p className="text-xs text-gray-300">{formatRelativeTime(conv.last_message_at)}</p>
            </div>
          ))
        )}
      </div>

      {/* Chat actif */}
      {activeConv ? (
        <div className="flex-1 bg-white rounded-xl border border-gray-100 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  msg.type === 'system'
                    ? 'bg-gray-100 text-gray-500 text-xs mx-auto'
                    : msg.sender_id === user.id
                    ? 'bg-[#1B6B3A] text-white self-end rounded-br-sm'
                    : 'bg-[#F7F3EE] text-[#1A1A18] self-start rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez un message..."
              className="flex-1 px-4 py-2 rounded-full border border-gray-200 text-sm outline-none focus:border-[#1B6B3A]"
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-[#1B6B3A] text-white flex items-center justify-center hover:bg-[#145229] transition"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400 text-sm">
          Sélectionnez une conversation
        </div>
      )}
    </div>
  );
};

export default Messages;