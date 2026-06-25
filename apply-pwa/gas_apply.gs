/**
 * 社内申請アプリ用 gas.gs 追記内容
 *
 * ▼ 作業手順
 * 1. gas.gs の APPLY_APP_CONFIG に下記を追加する
 * 2. gas.gs の CONFIG に applyAppId・applyToken を追加する
 * 3. スクリプトプロパティに APPLY_TOKEN・EXPENSE_TOKEN を設定する
 * 4. 再デプロイする（新しいバージョン）
 *
 * ※ doPost の switch 文は変更不要（getApply/saveApply等は既に登録済み）
 * ※ 出張費精算（app 1093）は getExpenses/saveExpense 等の既存関数をそのまま使う
 */

// ============================================================
// ① gas.gs の CONFIG に追記（既存の CONFIG オブジェクト内に追加）
// ============================================================
//
//   applyAppId:   '465',
//   applyToken:   PropertiesService.getScriptProperties().getProperty('APPLY_TOKEN'),
//
//   // expenseToken は既にある場合は下記で上書き
//   expenseToken: PropertiesService.getScriptProperties().getProperty('EXPENSE_TOKEN'),

// ============================================================
// ② gas.gs の APPLY_APP_CONFIG に追記
// ============================================================
//
// 現在の APPLY_APP_CONFIG は空なので、以下を追加する:
//
//   const APPLY_APP_CONFIG = {
//
//     // 休暇申請（app 465）
//     leave: {
//       appId: CONFIG.applyAppId,
//       token: CONFIG.applyToken,
//       fields: {
//         applicantId:     'applicant_id',
//         applicantName:   'applicant_name',
//         approvalStatus:  'status',
//         approverEmpId:   'approver_id',
//         rejectionReason: 'rejection_reason',
//       },
//       extraFields: {
//         content: 'content',   // JSON文字列をそのまま保存
//       },
//     },
//
//     // その他申請（app 465 と同じアプリを共用）
//     other: {
//       appId: CONFIG.applyAppId,
//       token: CONFIG.applyToken,
//       fields: {
//         applicantId:     'applicant_id',
//         applicantName:   'applicant_name',
//         approvalStatus:  'status',
//         approverEmpId:   'approver_id',
//         rejectionReason: 'rejection_reason',
//       },
//       extraFields: {
//         content: 'content',
//       },
//     },
//
//   };

// ============================================================
// ③ スクリプトプロパティに設定（GASエディタ → プロジェクトの設定）
// ============================================================
//
//   APPLY_TOKEN   : app 465 の API トークン
//   EXPENSE_TOKEN : app 1093 の API トークン
