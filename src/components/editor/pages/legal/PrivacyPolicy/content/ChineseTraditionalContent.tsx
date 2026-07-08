import { Section } from './Section';

export function ChineseTraditionalContent() {
  return (
    <>
      <Section title="1. 簡介">
        <p>
          IMAGINE（以下簡稱「本服務」）是由Kaya Matsumoto（以下簡稱「營運方」）提供的橫幅設計輔助工具。
          本隱私權政策說明本服務如何處理個人資訊。
        </p>
      </Section>

      <Section title="2. 收集的資訊">
        <p className="mb-2">本服務收集以下資訊：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>帳戶資訊</strong>: 透過Google OAuth取得的電子郵件地址、姓名、頭像
          </li>
          <li>
            <strong>付款資訊</strong>: 透過Stripe處理的信用卡資訊（本服務不儲存）
          </li>
          <li>
            <strong>使用資訊</strong>: 建立的橫幅設計、上傳的圖片、服務使用記錄
          </li>
          <li>
            <strong>技術資訊</strong>: IP位址、瀏覽器資訊、存取日誌
          </li>
        </ul>
      </Section>

      <Section title="3. 資訊使用目的">
        <p className="mb-2">收集的資訊將用於以下目的：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>服務的提供·營運·改進</li>
          <li>使用者支援</li>
          <li>付款處理及訂閱管理</li>
          <li>防止不當使用·安全對策</li>
          <li>使用情況分析·統計資料建立</li>
          <li>重要通知</li>
        </ul>
      </Section>

      <Section title="4. 第三方提供">
        <p className="mb-2">本服務使用以下第三方服務：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Supabase</strong>: 資料庫·認證·儲存（美國）
          </li>
          <li>
            <strong>Stripe</strong>: 付款處理（美國）
          </li>
          <li>
            <strong>Google</strong>: OAuth認證（美國）
          </li>
          <li>
            <strong>Vercel</strong>: 主機（美國）
          </li>
        </ul>
        <p className="mt-3 text-gray-700">
          這些服務根據各自的隱私權政策處理資訊。
          除法律規定外，未經使用者同意，我們不會向第三方提供個人資訊。
        </p>
      </Section>

      <Section title="5. 資料保存期限">
        <p>
          個人資訊在帳戶有效期間保存。帳戶刪除後，除法律規定的期限外，
          將立即刪除。
        </p>
      </Section>

      <Section title="6. 安全">
        <p>
          本服務為防止個人資訊洩露、遺失、損毀，採取適當的安全措施。
          資料通訊採用SSL/TLS加密，資料庫存取受到嚴格限制。
        </p>
      </Section>

      <Section title="7. 使用者權利">
        <p className="mb-2">使用者擁有以下權利：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>要求查看自己的個人資訊</li>
          <li>要求更正·刪除個人資訊</li>
          <li>要求停止使用個人資訊</li>
          <li>刪除帳戶</li>
        </ul>
        <p className="mt-3 text-gray-700">
          如需行使這些權利，請聯絡 contact@whatif-ep.xyz。
        </p>
      </Section>

      <Section title="8. Cookie（Cookie）">
        <p>
          本服務為提高服務便利性使用Cookie。
          您可以在瀏覽器設定中停用Cookie，但部分功能可能無法使用。
        </p>
      </Section>

      <Section title="9. 兒童隱私">
        <p>
          本服務不面向13歲以下兒童。
          如發現13歲以下兒童誤提供個人資訊，將立即刪除。
        </p>
      </Section>

      <Section title="10. 隱私權政策變更">
        <p>
          本隱私權政策可能因法律變更或服務改進而不預先通知變更。
          如有重要變更，將透過服務內或郵件通知。
        </p>
      </Section>

      <Section title="11. 聯絡我們">
        <p>
          關於本隱私權政策的問題，請聯絡：
        </p>
        <p className="mt-2 text-gray-700">
          電子信箱: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
