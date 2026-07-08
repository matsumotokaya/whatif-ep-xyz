import { Link } from '@/components/editor/lib/router';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function JapaneseContent() {
  return (
    <>
      <Section title="1. はじめに">
        <p>
          IMAGINE(イマジン)（以下「当サービス」）は、ユーザーの皆様の情報セキュリティを最優先事項として、
          適切な技術的・組織的対策を講じています。
        </p>
      </Section>

      <Section title="2. データの暗号化">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">通信の暗号化</h3>
            <p className="text-gray-700">
              当サービスは、すべての通信に対してTLS/SSL（HTTPS）暗号化プロトコルを使用しています。
              これにより、お客様のブラウザと当サービス間で送受信されるデータは、第三者による盗聴や改ざんから保護されます。
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">保存データの暗号化</h3>
            <p className="text-gray-700">
              データベースに保存されるユーザー情報は、業界標準の暗号化技術により保護されています。
            </p>
          </div>
        </div>
      </Section>

      <Section title="3. 認証とアクセス制御">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Google OAuth 2.0認証</strong>:
            安全性の高いGoogleアカウント認証を採用し、パスワードを当サービスで保存しません。
          </li>
          <li>
            <strong>行レベルセキュリティ（RLS）</strong>:
            データベースレベルでアクセス制御を実施し、ユーザーは自分のデータのみにアクセス可能です。
          </li>
          <li>
            <strong>セッション管理</strong>:
            安全なセッショントークンにより、不正アクセスを防止します。
          </li>
        </ul>
      </Section>

      <Section title="4. 決済情報のセキュリティ">
        <p className="mb-3">
          当サービスは、決済処理にStripeを使用しています。クレジットカード情報は当サービスのサーバーを経由せず、
          PCI DSS（Payment Card Industry Data Security Standard）準拠のStripeが直接処理します。
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>クレジットカード番号は当サービスで保存・保持しません</li>
          <li>Stripeは国際的なセキュリティ基準PCI DSS Level 1認証を取得しています</li>
        </ul>
      </Section>

      <Section title="5. データバックアップ">
        <p className="text-gray-700">
          データの損失を防ぐため、Supabase（データベース・ストレージプロバイダー）により
          定期的な自動バックアップが実施されています。
        </p>
      </Section>

      <Section title="6. インフラストラクチャのセキュリティ">
        <div className="space-y-2">
          <p><strong>利用サービス</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>Vercel</strong>: エンタープライズグレードのホスティング、DDoS保護、自動SSL証明書</li>
            <li><strong>Supabase</strong>: PostgreSQLデータベース、エンタープライズレベルのセキュリティ</li>
            <li><strong>Stripe</strong>: PCI DSS準拠の決済処理</li>
          </ul>
          <p className="mt-3 text-gray-700">
            すべてのインフラストラクチャは、業界標準のセキュリティ対策を実施している信頼性の高いプロバイダーを使用しています。
          </p>
        </div>
      </Section>

      <Section title="7. セキュリティインシデント対応">
        <p className="mb-2">
          万が一、セキュリティインシデントが発生した場合は、以下の対応を行います：
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>速やかに原因を特定し、被害の拡大を防止</li>
          <li>影響を受けるユーザーへの通知</li>
          <li>必要に応じて関係当局への報告</li>
          <li>再発防止策の実施</li>
        </ul>
      </Section>

      <Section title="8. ユーザーの皆様へのお願い">
        <p className="mb-2">セキュリティを維持するため、以下の点にご協力ください：</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>ログイン情報を第三者と共有しないでください</li>
          <li>共有端末使用後は必ずログアウトしてください</li>
          <li>不審な活動を発見した場合は速やかにご連絡ください</li>
        </ul>
      </Section>

      <Section title="9. お問い合わせ">
        <p>
          セキュリティに関するご質問やご報告は、
          <Link to="/contact" className="text-blue-600 hover:underline mx-1">
            お問い合わせページ
          </Link>
          または contact@whatif-ep.xyz までご連絡ください。
        </p>
      </Section>
    </>
  );
}
