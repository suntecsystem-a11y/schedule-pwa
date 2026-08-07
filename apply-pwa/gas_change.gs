// =============================================================================
// 従業員情報変更届 GAS関数
// =============================================================================
// ※ このファイルは参照用です。実際のコードは schedule-pwa/gas.gs に統合済みです。
//
// 統合先: schedule-pwa/gas.gs
// 統合日: 2026-08-07
//
// 追加された内容:
//   - CONFIG に changeAppId('1128'), changeToken を追加
//   - U に フリガナ(苗字カナ/名前カナ), 郵便番号, 住所, 電話番号, 緊急連絡先①②のフィールドコードを追加
//   - doPost に 6件の case を追加 (getEmployeeDetail, saveChangeRequest, getChangeRequests,
//     approveChangeRequest, rejectChangeRequest, withdrawChangeRequest)
//   - CHANGE_F 定数（変更届アプリのフィールドコードマッピング）
//   - getEmployeeDetail() — 従業員名簿からフル情報取得
//   - saveChangeRequest()  — 変更届レコード追加 + 総務部へFCM通知
//   - _getSoumuEmpIds()    — 総務部の社員番号リスト取得
//   - getChangeRequests()  — 変更届一覧取得
//   - approveChangeRequest() / rejectChangeRequest() / withdrawChangeRequest()
//
// Kintoneフィールドコード（従業員名簿）:
//   氏名, 苗字カナ, 名前カナ, 郵便番号, 住所, 電話番号,
//   緊急連絡先_氏名, 緊急連絡先氏名カナ, 緊急連絡先_関係, 緊急連絡先_電話番号, 緊急連絡先_固定電話,
//   緊急連絡先_氏名_2, 緊急連絡先氏名カナ_2, 緊急連絡先_関係_2, 緊急連絡先_電話番号_2, 緊急連絡先_固定電話_2
//
// セットアップ手順:
//   1. Kintone変更届アプリ(1128)のAPIトークン発行（レコード追加・編集・閲覧権限）
//   2. GASスクリプトプロパティに CHANGE_TOKEN を追加
//   3. GASを再デプロイ
// =============================================================================
