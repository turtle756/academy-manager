package site.classmanager.kiosk

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private lateinit var webView: WebView
    private var pendingNfcAction: String? = null // "kiosk" or "register:studentId:studentName"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.userAgentString = settings.userAgentString + " ClassManagerApp"
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            addJavascriptInterface(NfcBridge(), "AndroidNfc")
        }
        setContentView(webView)
        webView.loadUrl("https://classmanager.site")

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        enableNfcForegroundDispatch()
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    private fun enableNfcForegroundDispatch() {
        val intent = Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE)
        val filters = arrayOf(
            IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED),
        )
        val techLists = arrayOf(
            arrayOf("android.nfc.tech.NfcA"),
            arrayOf("android.nfc.tech.Ndef"),
            arrayOf("android.nfc.tech.MifareUltralight"),
        )
        nfcAdapter?.enableForegroundDispatch(this, pendingIntent, filters, techLists)
    }

    private fun handleIntent(intent: Intent) {
        val action = intent.action ?: return
        if (action == NfcAdapter.ACTION_TAG_DISCOVERED ||
            action == NfcAdapter.ACTION_NDEF_DISCOVERED ||
            action == NfcAdapter.ACTION_TECH_DISCOVERED
        ) {
            val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            tag?.let {
                val uid = it.id.joinToString("") { byte -> "%02X".format(byte) }
                onNfcTagScanned(uid)
            }
        }
    }

    private fun onNfcTagScanned(uid: String) {
        val action = pendingNfcAction
        runOnUiThread {
            if (action != null && action.startsWith("register:")) {
                // NFC 등록 모드 — 결과를 웹에 전달
                val parts = action.split(":")
                val studentId = parts[1]
                webView.evaluateJavascript(
                    "if(window.onNfcResult) window.onNfcResult($studentId, '$uid');",
                    null
                )
                pendingNfcAction = null
            } else {
                // 키오스크 출석 모드 — 결과를 웹에 전달
                webView.evaluateJavascript(
                    "if(window.onKioskNfcScan) window.onKioskNfcScan('$uid');",
                    null
                )
            }
        }
    }

    inner class NfcBridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = nfcAdapter != null && nfcAdapter!!.isEnabled

        @JavascriptInterface
        fun requestNfcScan(studentId: Int, studentName: String) {
            // 등록 모드 — 다음 NFC 터치를 등록으로 처리
            pendingNfcAction = "register:$studentId:$studentName"
        }

        @JavascriptInterface
        fun startKioskNfc() {
            // 키오스크 모드 — NFC 터치를 출석으로 처리 (기본 상태)
            pendingNfcAction = null
        }

        @JavascriptInterface
        fun cancelNfcScan() {
            pendingNfcAction = null
        }
    }
}
