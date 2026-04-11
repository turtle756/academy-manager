package site.classmanager.kiosk

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.nfc.tech.NfcA
import android.nfc.tech.MifareUltralight
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent

class MainActivity : AppCompatActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private lateinit var webView: WebView
    private var pendingNfcAction: String? = null

    private val BASE_URL = "https://classmanager.site"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.userAgentString = settings.userAgentString + " ClassManagerApp"
            webChromeClient = WebChromeClient()
            addJavascriptInterface(NfcBridge(), "AndroidNfc")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false
                    if (url.contains("accounts.google.com")) {
                        val customTab = CustomTabsIntent.Builder().build()
                        customTab.launchUrl(this@MainActivity, Uri.parse(url))
                        return true
                    }
                    if (url.startsWith(BASE_URL)) return false
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }
            }
        }
        setContentView(webView)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        // NFC intent로 실행된 경우 — 웹만 로드하고 NFC는 onResume 후 처리
        val action = intent?.action
        val isNfc = action == NfcAdapter.ACTION_TAG_DISCOVERED ||
                    action == NfcAdapter.ACTION_NDEF_DISCOVERED ||
                    action == NfcAdapter.ACTION_TECH_DISCOVERED

        if (intent?.data != null && !isNfc) {
            handleDeepLink(intent)
        } else {
            webView.loadUrl(BASE_URL)
        }

        // NFC로 앱이 처음 실행된 경우 태그 처리
        if (isNfc) {
            val tag: Tag? = intent?.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            tag?.let {
                val uid = it.id.joinToString("") { byte -> "%02X".format(byte) }
                // 약간 딜레이 후 처리 (WebView 로드 대기)
                webView.postDelayed({ onNfcTagScanned(uid) }, 2000)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Foreground dispatch — 앱이 열려있으면 모든 NFC를 이 앱이 받음
        nfcAdapter?.let { adapter ->
            val intent = Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            val pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

            // NDEF 필터 — text/plain MIME
            val ndefFilter = IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED).apply {
                try { addDataType("*/*") } catch (e: Exception) {}
            }
            // TAG 필터 — 모든 태그
            val tagFilter = IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
            // TECH 필터
            val techFilter = IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)

            val filters = arrayOf(ndefFilter, techFilter, tagFilter)
            val techLists = arrayOf(
                arrayOf(NfcA::class.java.name),
                arrayOf(Ndef::class.java.name),
                arrayOf(MifareUltralight::class.java.name),
            )
            adapter.enableForegroundDispatch(this, pendingIntent, filters, techLists)
        }
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)

        // NFC 처리
        val action = intent.action
        if (action == NfcAdapter.ACTION_TAG_DISCOVERED ||
            action == NfcAdapter.ACTION_NDEF_DISCOVERED ||
            action == NfcAdapter.ACTION_TECH_DISCOVERED
        ) {
            val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            tag?.let {
                val uid = it.id.joinToString("") { byte -> "%02X".format(byte) }
                onNfcTagScanned(uid)
            }
            return
        }

        // 딥링크 처리
        handleDeepLink(intent)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        val url = uri.toString()
        if (url.startsWith(BASE_URL)) {
            webView.loadUrl(url)
        }
    }

    private fun onNfcTagScanned(uid: String) {
        val action = pendingNfcAction
        runOnUiThread {
            if (action != null && action.startsWith("register:")) {
                val parts = action.split(":")
                val studentId = parts[1]
                webView.evaluateJavascript(
                    "if(window.onNfcResult) window.onNfcResult($studentId, '$uid');",
                    null
                )
                pendingNfcAction = null
            } else {
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
            pendingNfcAction = "register:$studentId:$studentName"
        }

        @JavascriptInterface
        fun startKioskNfc() {
            pendingNfcAction = null
        }

        @JavascriptInterface
        fun cancelNfcScan() {
            pendingNfcAction = null
        }
    }
}
