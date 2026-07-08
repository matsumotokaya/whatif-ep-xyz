import { Section } from './Section';

export function ChineseSimplifiedContent() {
  return (
    <>
      <Section title="1. 简介">
        <p>
          IMAGINE（以下简称"本服务"）是由Kaya Matsumoto（以下简称"运营方"）提供的横幅设计辅助工具。
          本隐私政策说明本服务如何处理个人信息。
        </p>
      </Section>

      <Section title="2. 收集的信息">
        <p className="mb-2">本服务收集以下信息：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>账户信息</strong>: 通过Google OAuth获取的电子邮箱地址、姓名、头像
          </li>
          <li>
            <strong>支付信息</strong>: 通过Stripe处理的信用卡信息（本服务不存储）
          </li>
          <li>
            <strong>使用信息</strong>: 创建的横幅设计、上传的图片、服务使用记录
          </li>
          <li>
            <strong>技术信息</strong>: IP地址、浏览器信息、访问日志
          </li>
        </ul>
      </Section>

      <Section title="3. 信息使用目的">
        <p className="mb-2">收集的信息将用于以下目的：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>服务的提供·运营·改进</li>
          <li>用户支持</li>
          <li>支付处理及订阅管理</li>
          <li>防止不当使用·安全对策</li>
          <li>使用情况分析·统计数据创建</li>
          <li>重要通知</li>
        </ul>
      </Section>

      <Section title="4. 第三方提供">
        <p className="mb-2">本服务使用以下第三方服务：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Supabase</strong>: 数据库·认证·存储（美国）
          </li>
          <li>
            <strong>Stripe</strong>: 支付处理（美国）
          </li>
          <li>
            <strong>Google</strong>: OAuth认证（美国）
          </li>
          <li>
            <strong>Vercel</strong>: 托管（美国）
          </li>
        </ul>
        <p className="mt-3 text-gray-700">
          这些服务根据各自的隐私政策处理信息。
          除法律规定外，未经用户同意，我们不会向第三方提供个人信息。
        </p>
      </Section>

      <Section title="5. 数据保存期限">
        <p>
          个人信息在账户有效期间保存。账户删除后，除法律规定的期限外，
          将立即删除。
        </p>
      </Section>

      <Section title="6. 安全">
        <p>
          本服务为防止个人信息泄露、丢失、损坏，采取适当的安全措施。
          数据通信采用SSL/TLS加密，数据库访问受到严格限制。
        </p>
      </Section>

      <Section title="7. 用户权利">
        <p className="mb-2">用户拥有以下权利：</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>要求查看自己的个人信息</li>
          <li>要求更正·删除个人信息</li>
          <li>要求停止使用个人信息</li>
          <li>删除账户</li>
        </ul>
        <p className="mt-3 text-gray-700">
          如需行使这些权利，请联系 contact@whatif-ep.xyz。
        </p>
      </Section>

      <Section title="8. Cookie（Cookie）">
        <p>
          本服务为提高服务便利性使用Cookie。
          您可以在浏览器设置中禁用Cookie，但部分功能可能无法使用。
        </p>
      </Section>

      <Section title="9. 儿童隐私">
        <p>
          本服务不面向13岁以下儿童。
          如发现13岁以下儿童误提供个人信息，将立即删除。
        </p>
      </Section>

      <Section title="10. 隐私政策变更">
        <p>
          本隐私政策可能因法律变更或服务改进而不预先通知变更。
          如有重要变更，将通过服务内或邮件通知。
        </p>
      </Section>

      <Section title="11. 联系我们">
        <p>
          关于本隐私政策的问题，请联系：
        </p>
        <p className="mt-2 text-gray-700">
          电子邮箱: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
