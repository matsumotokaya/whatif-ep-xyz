import { Link } from '@/components/editor/lib/router';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function ChineseSimplifiedContent() {
  return (
    <>
      <Section title="1. 简介">
        <p>
          IMAGINE（以下简称"本服务"）将用户的信息安全作为首要任务，
          采取适当的技术和组织措施。
        </p>
      </Section>

      <Section title="2. 数据加密">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">通信加密</h3>
            <p className="text-gray-700">
              本服务对所有通信使用TLS/SSL（HTTPS）加密协议。
              这样可以保护您的浏览器与本服务之间传输的数据，防止第三方窃听和篡改。
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">存储数据加密</h3>
            <p className="text-gray-700">
              存储在数据库中的用户信息受行业标准加密技术保护。
            </p>
          </div>
        </div>
      </Section>

      <Section title="3. 认证与访问控制">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Google OAuth 2.0认证</strong>:
            采用安全的Google账户认证，本服务不存储密码。
          </li>
          <li>
            <strong>行级安全性（RLS）</strong>:
            在数据库级别实施访问控制，用户只能访问自己的数据。
          </li>
          <li>
            <strong>会话管理</strong>:
            使用安全的会话令牌防止未经授权的访问。
          </li>
        </ul>
      </Section>

      <Section title="4. 支付信息安全">
        <p className="mb-3">
          本服务使用Stripe进行支付处理。信用卡信息不经过本服务的服务器，
          由符合PCI DSS（支付卡行业数据安全标准）的Stripe直接处理。
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>本服务不存储或保留信用卡号</li>
          <li>Stripe已获得国际安全标准PCI DSS Level 1认证</li>
        </ul>
      </Section>

      <Section title="5. 数据备份">
        <p className="text-gray-700">
          为防止数据丢失，Supabase（数据库和存储提供商）会定期进行自动备份。
        </p>
      </Section>

      <Section title="6. 基础设施安全">
        <div className="space-y-2">
          <p><strong>使用的服务</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>Vercel</strong>: 企业级托管、DDoS保护、自动SSL证书</li>
            <li><strong>Supabase</strong>: PostgreSQL数据库、企业级安全</li>
            <li><strong>Stripe</strong>: 符合PCI DSS的支付处理</li>
          </ul>
          <p className="mt-3 text-gray-700">
            所有基础设施都使用实施行业标准安全措施的可靠提供商。
          </p>
        </div>
      </Section>

      <Section title="7. 安全事件响应">
        <p className="mb-2">
          万一发生安全事件，我们将采取以下措施：
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>迅速查明原因并防止损害扩大</li>
          <li>通知受影响的用户</li>
          <li>必要时向有关部门报告</li>
          <li>实施防止再次发生的措施</li>
        </ul>
      </Section>

      <Section title="8. 给用户的请求">
        <p className="mb-2">为维护安全，请配合以下事项：</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>请勿与第三方共享登录信息</li>
          <li>使用共享设备后务必退出登录</li>
          <li>如发现可疑活动，请立即联系我们</li>
        </ul>
      </Section>

      <Section title="9. 联系我们">
        <p>
          有关安全的问题或报告，请通过
          <Link to="/contact" className="text-blue-600 hover:underline mx-1">
            联系页面
          </Link>
          或 contact@whatif-ep.xyz 与我们联系。
        </p>
      </Section>
    </>
  );
}
