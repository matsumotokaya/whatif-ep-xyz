import { Link } from '@/components/editor/lib/router';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function ChineseTraditionalContent() {
  return (
    <>
      <Section title="1. 簡介">
        <p>
          IMAGINE（以下簡稱「本服務」）將使用者的資訊安全作為首要任務，
          採取適當的技術和組織措施。
        </p>
      </Section>

      <Section title="2. 資料加密">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">通訊加密</h3>
            <p className="text-gray-700">
              本服務對所有通訊使用TLS/SSL（HTTPS）加密協定。
              這樣可以保護您的瀏覽器與本服務之間傳輸的資料，防止第三方竊聽和竄改。
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">儲存資料加密</h3>
            <p className="text-gray-700">
              儲存在資料庫中的使用者資訊受業界標準加密技術保護。
            </p>
          </div>
        </div>
      </Section>

      <Section title="3. 認證與存取控制">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Google OAuth 2.0認證</strong>:
            採用安全的Google帳戶認證，本服務不儲存密碼。
          </li>
          <li>
            <strong>列級安全性（RLS）</strong>:
            在資料庫層級實施存取控制，使用者只能存取自己的資料。
          </li>
          <li>
            <strong>工作階段管理</strong>:
            使用安全的工作階段權杖防止未經授權的存取。
          </li>
        </ul>
      </Section>

      <Section title="4. 付款資訊安全">
        <p className="mb-3">
          本服務使用Stripe進行付款處理。信用卡資訊不經過本服務的伺服器，
          由符合PCI DSS（支付卡產業資料安全標準）的Stripe直接處理。
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>本服務不儲存或保留信用卡號</li>
          <li>Stripe已獲得國際安全標準PCI DSS Level 1認證</li>
        </ul>
      </Section>

      <Section title="5. 資料備份">
        <p className="text-gray-700">
          為防止資料遺失，Supabase（資料庫和儲存提供商）會定期進行自動備份。
        </p>
      </Section>

      <Section title="6. 基礎設施安全">
        <div className="space-y-2">
          <p><strong>使用的服務</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>Vercel</strong>: 企業級主機、DDoS保護、自動SSL憑證</li>
            <li><strong>Supabase</strong>: PostgreSQL資料庫、企業級安全</li>
            <li><strong>Stripe</strong>: 符合PCI DSS的付款處理</li>
          </ul>
          <p className="mt-3 text-gray-700">
            所有基礎設施都使用實施業界標準安全措施的可靠提供商。
          </p>
        </div>
      </Section>

      <Section title="7. 安全事件回應">
        <p className="mb-2">
          萬一發生安全事件，我們將採取以下措施：
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>迅速查明原因並防止損害擴大</li>
          <li>通知受影響的使用者</li>
          <li>必要時向有關部門報告</li>
          <li>實施防止再次發生的措施</li>
        </ul>
      </Section>

      <Section title="8. 給使用者的請求">
        <p className="mb-2">為維護安全，請配合以下事項：</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>請勿與第三方共享登入資訊</li>
          <li>使用共用裝置後務必登出</li>
          <li>如發現可疑活動，請立即聯絡我們</li>
        </ul>
      </Section>

      <Section title="9. 聯絡我們">
        <p>
          有關安全的問題或報告，請透過
          <Link to="/contact" className="text-blue-600 hover:underline mx-1">
            聯絡頁面
          </Link>
          或 contact@whatif-ep.xyz 與我們聯絡。
        </p>
      </Section>
    </>
  );
}
