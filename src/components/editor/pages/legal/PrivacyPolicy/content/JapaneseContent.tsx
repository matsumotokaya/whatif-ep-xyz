import { Section } from './Section';

export function JapaneseContent() {
  return (
    <>
      <Section title="1. はじめに">
        <p>
          IMAGINE(イマジン)（以下「当サービス」）は、松本夏弥（以下「運営者」）が提供するバナーデザインアシスタントツールです。
          本プライバシーポリシーは、当サービスにおける個人情報の取扱いについて説明するものです。
        </p>
      </Section>

      <Section title="2. 収集する情報">
        <p className="mb-2">当サービスでは、以下の情報を収集します：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>アカウント情報</strong>: Google OAuth経由で取得するメールアドレス、氏名、プロフィール画像
          </li>
          <li>
            <strong>決済情報</strong>: Stripeを通じて処理されるクレジットカード情報（当サービスでは保存しません）
          </li>
          <li>
            <strong>利用情報</strong>: 作成したバナーデザイン、アップロードした画像、サービス利用履歴
          </li>
          <li>
            <strong>技術情報</strong>: IPアドレス、ブラウザ情報、アクセスログ
          </li>
        </ul>
      </Section>

      <Section title="3. 情報の利用目的">
        <p className="mb-2">収集した情報は、以下の目的で利用します：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>サービスの提供・運営・改善</li>
          <li>ユーザーサポート対応</li>
          <li>決済処理およびサブスクリプション管理</li>
          <li>不正利用の防止・セキュリティ対策</li>
          <li>利用状況の分析・統計データの作成</li>
          <li>重要なお知らせの通知</li>
        </ul>
      </Section>

      <Section title="4. 第三者への提供">
        <p className="mb-2">当サービスは、以下の第三者サービスを利用しています：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Supabase</strong>: データベース・認証・ストレージ（米国）
          </li>
          <li>
            <strong>Stripe</strong>: 決済処理（米国）
          </li>
          <li>
            <strong>Google</strong>: OAuth認証（米国）
          </li>
          <li>
            <strong>Vercel</strong>: ホスティング（米国）
          </li>
        </ul>
        <p className="mt-3 text-gray-700">
          これらのサービスは、それぞれのプライバシーポリシーに基づいて情報を処理します。
          法令に基づく場合を除き、ユーザーの同意なく第三者に個人情報を提供することはありません。
        </p>
      </Section>

      <Section title="5. データの保存期間">
        <p>
          個人情報は、アカウントが有効な間保存されます。アカウント削除後は、法令で定められた期間を除き、
          速やかに削除いたします。
        </p>
      </Section>

      <Section title="6. セキュリティ">
        <p>
          当サービスは、個人情報の漏洩、滅失、毀損を防止するため、適切なセキュリティ対策を講じています。
          データ通信はSSL/TLSで暗号化され、データベースへのアクセスは厳格に制限されています。
        </p>
      </Section>

      <Section title="7. ユーザーの権利">
        <p className="mb-2">ユーザーは、以下の権利を有します：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>自己の個人情報の開示請求</li>
          <li>個人情報の訂正・削除請求</li>
          <li>個人情報の利用停止請求</li>
          <li>アカウントの削除</li>
        </ul>
        <p className="mt-3 text-gray-700">
          これらの権利を行使する場合は、contact@whatif-ep.xyz までご連絡ください。
        </p>
      </Section>

      <Section title="8. Cookie（クッキー）">
        <p>
          当サービスは、サービスの利便性向上のためCookieを使用します。
          ブラウザの設定でCookieを無効化することも可能ですが、一部機能が利用できなくなる場合があります。
        </p>
      </Section>

      <Section title="9. 子供のプライバシー">
        <p>
          当サービスは、13歳未満の子供を対象としていません。
          13歳未満の方が誤って個人情報を提供したことが判明した場合、速やかに削除いたします。
        </p>
      </Section>

      <Section title="10. プライバシーポリシーの変更">
        <p>
          本プライバシーポリシーは、法令の変更やサービスの改善に伴い、予告なく変更される場合があります。
          重要な変更がある場合は、サービス内またはメールで通知いたします。
        </p>
      </Section>

      <Section title="11. お問い合わせ">
        <p>
          本プライバシーポリシーに関するご質問は、以下までお問い合わせください：
        </p>
        <p className="mt-2 text-gray-700">
          メールアドレス: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
