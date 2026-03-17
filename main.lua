scriptTitle = "GodStix \"Speedy Games Downloads\""
scriptAuthor = "Speedy Games Downloads"
scriptVersion = "1.0"
scriptDescription = "Browse and download Xbox 360 games from the GODSend server."
scriptIcon = "icon\\icon.xur"
scriptPermissions = { "http", "filesystem", "content", "kernel", "sql" }

require("MenuSystem")
json = require("JSON")

SERVER_URL = "http://stix.speedygamesdownloads.com"
API_BASE = SERVER_URL .. "/api"
TEMP_FOLDER = "0"

gInstallDrive = "Hdd1:"
gAbortedOperation = false
gAbortLastToggleTime = 0
gAbortShowHint = false
gDownloadStartTime = 0
gLastProgressUpdate = 0
gCurrentPart = 0
gTotalParts = 0
gCurrentAttempt = 0
gMaxAttempts = 3
gTempDownloadCounter = 0
gKnownFileSize = 0
gUseFastDownload = false
gCurrentFileId = ""
gCurrentDownloadId = ""
gCurrentGameTitle = ""
gCurrentFileName = ""
gCurrentTotalSize = 0
gCurrentLang = "pt_br"
gDownloadedFileIds = {}
gMyGamesDrive = ""
gLoggedIn = false
gGuestMode = false
gUserId = 0
gUserName = ""
gUserLevel = 0
gUserLevelName = ""
gDailyLimit = 0
gDownloadsToday = 0
gDownloadsRemaining = -1
gDaysRemaining = nil
gUserAllowed = false
gConsoleId = ""
gDownloadQueue = {}

LANGUAGES = {
    { code = "pt_br", name = "Portugues (BR)" },
    { code = "en", name = "English" },
    { code = "es", name = "Espanol" }
}

STRINGS = {
    pt_br = {
        browse_all = "Navegar Todos os Jogos",
        search = "Buscar Jogos",
        browse_platform = "Navegar por Plataforma",
        settings = "Configuracoes",
        about = "Sobre",
        select_platform = "Selecionar Plataforma",
        install_drive = "Drive de Instalacao",
        server = "Servidor",
        test_connection = "Testar Conexao",
        dns_guide = "Guia de Otimizacao DNS",
        language = "Idioma",
        back = "< Voltar",
        no_network = "Sem Rede",
        no_network_msg = "Seu Xbox nao esta conectado a rede.\n\n1. Verifique o cabo ethernet ou WiFi\n2. Va em Configuracoes do Xbox > Rede\n3. Certifique-se que o roteador esta ligado",
        connection_failed = "Falha na Conexao",
        connection_ok = "Conexao OK!",
        download = "Download",
        download_confirm = "Baixar: %s?\n\nTipo: %s\nDestino: %s",
        download_all = "Baixar Todos",
        download_all_confirm = "Baixar todos os %d arquivos deste jogo?\n\nDestino: %s",
        downloading = "Baixando: %s...",
        download_complete = "Download Completo",
        download_complete_msg = "Baixados: %d / %d arquivos\n%sVa em Configuracoes > Conteudo > Scan\npara atualizar sua biblioteca.",
        success = "Sucesso",
        success_msg = "%s baixado com sucesso!\n\nVa em Configuracoes > Conteudo > Scan\npara atualizar sua biblioteca.",
        complete = "Completo",
        error = "Erro",
        no_results = "Sem Resultados",
        no_results_msg = "Nenhum jogo encontrado para: \"%s\"\n\nTente um termo diferente.",
        empty = "Vazio",
        empty_msg = "Nenhum jogo disponivel no servidor.\n\nJogos precisam ser adicionados pelo painel admin.",
        no_files = "Sem Arquivos",
        no_files_msg = "Nenhum arquivo para download encontrado no servidor.",
        no_files_available = "Nenhum arquivo disponivel",
        files_separator = ".--- { DOWNLOADS } ---.",
        download_all_btn = ">> Baixar TODOS os Arquivos",
        view_description = "Ver Descricao",
        publisher_label = "Editora",
        game_type = "[JOGO]",
        dlc_type = "[DLC]",
        update_type = "[TU]",
        translation_type = "[TRADUCAO]",
        file_type = "[ARQUIVO]",
        checking_files = "Verificando arquivos...",
        loading_games = "Carregando jogos...",
        loading_details = "Carregando detalhes do jogo...",
        connecting = "Conectando ao servidor GODSend...",
        select_drive = "Selecionar Drive de Instalacao",
        server_url_msg = "Atual: %s\n\nEdite o GODSend.ini para alterar a URL do servidor.",
        move_error = "Erro ao Mover",
        move_error_msg = "Download OK mas nao foi possivel mover.\n\nDe: %s\nPara: %s\n\nErro: %s\n\nArquivo salvo na pasta temporaria.",
        failed_count = "Falhou: %d\n",
        select_language = "Selecionar Idioma",
        welcome_title = "Bem-vindo!",
        welcome_msg = "Bem-vindo ao GodStix!\n\nProduzido por SpeedyGamesDownloads\n\nSelecione seu idioma preferido.",
        language_changed = "Idioma alterado!",
        dns_title = "Otimizacao DNS - Cloudflare",
        dns_msg = "Para downloads mais rapidos e estaveis,\nconfigure o DNS Cloudflare (1.1.1.1).\n\nNO SEU XBOX 360:\n1. Va em Configuracoes do Sistema\n2. Configuracoes de Rede\n3. Selecione sua conexao\n4. Configurar Rede\n5. Config. DNS > Manual\n6. DNS Primario: 1.1.1.1\n7. DNS Secundario: 1.0.0.1\n\nNO SEU ROTEADOR (opcional):\nAltere o DNS nas configuracoes\npara 1.1.1.1 e 1.0.0.1\nTodos os dispositivos serao beneficiados.",
        about_msg = "Navegue, busque e baixe jogos Xbox 360\ndiretamente do seu console.\n\nFuncoes:\n- Navegar todos os jogos\n- Buscar jogos por nome\n- Filtrar por plataforma\n- Meus Jogos (analisa jogos instalados)\n- Download com selecao de drive\n- Badge de arquivos ja baixados\n- Multi-idioma (PT-BR, EN, ES)\n\nDrive: %s",
        games_count = "%d jogos",
        error_occurred = "Ocorreu um erro:\n\n%s\n\nO script voltara ao menu principal.",
        error_loading = "Erro ao carregar jogos:\n%s",
        error_details = "Erro ao mostrar detalhes:\n%s",
        parse_error = "Erro de Analise",
        parse_error_msg = "Servidor retornou %d jogos mas a analise falhou.\n\nPrevia da resposta:\n%s",
        search_prompt = "Insira o nome do jogo",
        keyboard_error = "Teclado nao disponivel:\n%s",
        file_info_error = "Nao foi possivel obter info do arquivo.\n\nErro: %s",
        conn_fail_msg = "Nao foi possivel conectar ao servidor.\n\nVerifique se:\n- Seu Xbox esta conectado a internet\n- O cabo de rede esta bem conectado\n- O roteador esta funcionando\n\nSe o problema persistir, entre em contato com o suporte.",
        https_warning = "\n\nAtencao: O servidor esta configurado com HTTPS, que nao e suportado pelo Xbox.",
        downloaded_notification = "%s baixado!",
        file_part = "Arquivo %d/%d: %s",
        retry_attempt = "Tentativa %d/%d...",
        retry_failed = "Falha na tentativa %d/%d. Tentando novamente...",
        all_retries_failed = "Download falhou apos %d tentativas.",
        retry_settings = "Tentativas de Download",
        retry_count = "Tentativas: %s",
        retry_disabled = "Desativado",
        retry_select = "Numero de tentativas (atual: %s)",
        retry_off = "Desativar tentativas",
        download_aborted = "Download cancelado.",
        abort_cleanup = "Cancelando...",
        abort_cleanup_1 = "Cancelando...",
        abort_cleanup_2 = "Para acelerar, reinicie o Aurora.",
        download_time = "Tempo: %s",
        success_time_msg = "%s baixado com sucesso!\nTempo: %s\nVelocidade media: %s\n\nVa em Configuracoes > Conteudo > Scan\npara atualizar sua biblioteca.",
        download_complete_time_msg = "Baixados: %d / %d arquivos\n%sTempo total: %s\nVelocidade media: %s\n\nVa em Configuracoes > Conteudo > Scan\npara atualizar sua biblioteca.",
        retry_failed_files = "Tentar novamente %d arquivo(s) que falharam?",
        retrying_failed = "Tentando novamente arquivos que falharam...",
        retry_result = "Resultado da nova tentativa:\nBaixados: %d / %d\n%sTempo: %s",
        my_games = "Meus Jogos",
        scanning_folders = "Analisando pastas...",
        select_scan_drive = "Selecionar dispositivo para analise",
        no_titles_found = "Nenhum jogo instalado encontrado.\n\nVerifique se a permissao 'Conteudo'\nesta ativada nas configuracoes do script.",
        looking_up_titles = "Consultando jogos cadastrados...",
        not_registered = "Jogo Nao Cadastrado",
        not_registered_msg = "O jogo com Title ID \"%s\" ainda nao foi cadastrado na plataforma.\n\nEm breve sera adicionado!",
        downloaded_badge = "(Baixado)",
        installed_badge = " [v]",
        yes = "Sim",
        no = "Nao",
        my_games_count = "%d jogos encontrados",
        login_title = "Login",
        login_prompt = "Digite seu email ou usuario",
        password_prompt = "Digite sua senha",
        login_success = "Login realizado!",
        login_failed = "Falha no Login",
        login_failed_msg = "Email/usuario ou senha incorretos.\n\nVerifique seus dados e tente novamente.",
        login_error = "Erro de autenticacao:\n%s",
        login_info = "Logado como: %s\nNivel: Lv.%s - %s\nDownloads hoje: %d / %s",
        login_no_access = "Acesso Negado",
        login_no_access_msg = "Seu nivel de acesso nao permite usar esta ferramenta.\n\nNivel atual: %s\n\nEntre em contato com o suporte.",
        login_required_download = "Voce precisa estar logado para baixar arquivos.\n\nFaca login primeiro.",
        download_error_detail = "Erro ao iniciar download:",
        login_limit_reached = "Limite de Downloads",
        login_limit_msg = "Voce atingiu o limite diario de downloads.\n\nLimite: %d downloads/dia\nUsados: %d\n\nTente novamente amanha.",
        login_menu = "Minha Conta",
        logout = "Sair",
        downloads_remaining = "Downloads restantes: %s",
        login_required = "Login Necessario",
        login_required_msg = "Voce precisa fazer login para continuar.",
        splash_title = "GodStix",
        splash_msg = "GodStix v%s\n\nBaixe jogos de Xbox 360 direto no seu console!\n\nCadastre-se em www.speedygamesdownloads.com\n\nTorne-se membro para downloads ilimitados!\nMembros tem acesso ao catalogo completo.",
        guest_access = "Acesso Visitante (2 downloads/dia)",
        guest_login = "Login (Membro)",
        register_access = "Cadastro",
        register_msg = "Para se cadastrar, acesse o site:\n\nwww.speedygamesdownloads.com\n\nCrie sua conta e torne-se membro\npara downloads ilimitados!",
        guest_name = "Visitante",
        guest_limit_reached = "Limite de Visitante",
        guest_limit_msg = "Voce atingiu o limite de 2 downloads/dia como visitante.\n\nTorne-se membro para downloads ilimitados!\nspeedygamesdownloads.com",
        verify_installation = "Verificar Instalacao",
        verifying_files = "Verificando arquivos instalados...",
        verify_title = "Resultado da Verificacao",
        verify_ok = "OK",
        verify_missing = "AUSENTE",
        verify_wrong_size = "TAMANHO ERRADO",
        verify_all_ok = "Todos os arquivos estao corretos!",
        verify_summary = "Arquivos OK: %d\nAusentes: %d\nTamanho errado: %d",
        verify_redownload = "Deseja baixar novamente os %d arquivo(s) com problema?",
        verify_total_downloaded = "Total baixado",
        verify_no_files = "Nenhum arquivo para verificar.",
        verify_checking = "Verificando: %s...",
        browse_category = "Navegar por Categoria",
        select_category = "Selecionar Categoria",
        loading_categories = "Carregando categorias...",
        no_categories = "Nenhuma categoria disponivel.",
        console_info = "Info do Console",
        console_info_title = "Informacoes do Console",
        nova_webui = "Instalar WebUI",
        nova_install = "Instalar WebUI",
        nova_backup = "Fazer Backup da WebUI Atual",
        nova_update_titles = "Atualizar titles.json",
        nova_no_webuis = "Nenhuma WebUI disponivel",
        nova_select_webui = "Selecionar WebUI para Instalar",
        nova_backup_name = "Nome do Backup",
        nova_backup_prompt = "Digite um nome para a WebUI atual",
        nova_backup_exists = "Ja existe uma WebUI com esse nome.\nEscolha outro nome.",
        nova_backup_fail = "Falha ao fazer backup da WebUI atual",
        nova_backup_ok = "Backup realizado com sucesso",
        nova_install_fail_delete = "Falha ao remover WebUI atual.\nSaindo.",
        nova_install_fail_copy = "Falha ao copiar WebUI para o destino.\nSaindo.",
        nova_install_ok = "Instalacao concluida com sucesso",
        nova_install_access = "Acesse a WebUI em:\nhttp://%s:9999",
        nova_update_ask = "Deseja atualizar o titles.json?",
        nova_update_progress = "Atualizando titles.json",
        nova_update_fail = "Falha ao atualizar titles.json",
        nova_update_ok = "titles.json atualizado com sucesso",
        exit_script = "Finalizar Script",
        download_or_verify = "Opcoes de Download",
        download_game = "Baixar Arquivo",
        auto_login_msg = "Reconectando...",
        auto_login_fail = "Sessao expirada. Faca login novamente.",
        guest_check_fail = "Limite de 2 downloads/dia atingido.\n\nTorne-se membro para downloads ilimitados!\nspeedygamesdownloads.com",
        console_banned = "Console Banido",
        console_banned_msg = "Seu console foi banido do servidor.\n\nConsole ID: %s\n\nEntre em contato com o suporte.",
        retry_connection = "Tentar Novamente",
        exit_option = "Sair",
        connection_error_title = "Erro de Conexao",
        already_downloaded = "Arquivo Ja Baixado",
        already_downloaded_msg = "O arquivo \"%s\" ja existe na pasta de instalacao.\n\nDeseja baixar novamente e substituir?",
        restart_aurora = "Reiniciar Aurora",
        restart_aurora_msg = "Download concluido!\n\nDeseja reiniciar a Aurora para atualizar a lista de jogos?",
        no_drives = "Nenhum dispositivo de armazenamento encontrado.",
        rate_game = "Avaliacao",
        rate_title = "Avaliar Jogo",
        how_many_stars = "Quantas estrelas?",
        rate_stars = "%d Estrela(s)",
        rate_success = "Avaliacao enviada!",
        rate_current = "Media: %s estrelas (%d votos)",
        no_rating = "Sem avaliacoes",
        add_favorite = "Adicionar aos Favoritos",
        remove_favorite = "Remover dos Favoritos",
        favorite_added = "Adicionado aos favoritos!",
        favorite_removed = "Removido dos favoritos!",
        my_list = "Favoritos",
        no_favorites = "Seus favoritos estao vazios.",
        report_item = "Reportar Item",
        report_title = "Qual o problema?",
        report_wrong = "Item Errado",
        report_corrupted = "Item Corrompido",
        report_success = "Report enviado! Obrigado.",
        report_error = "Erro ao enviar report.",
        account_expires = "Assinatura expira em: %d dias",
        account_expired = "Assinatura expirada",
        download_list = "Lista de Downloads",
        add_to_download_list = "Adicionar a Lista de Downloads",
        remove_from_download_list = "Remover da Lista de Downloads",
        added_to_download_list = "\"%s\" adicionado a lista de downloads!",
        removed_from_download_list = "\"%s\" removido da lista de downloads!",
        already_in_download_list = "\"%s\" ja esta na lista de downloads.",
        download_list_empty = "A lista de downloads esta vazia.",
        download_all_list = "Baixar Todos",
        clear_download_list = "Limpar Lista",
        download_list_cleared = "Lista de downloads limpa!",
        auto_shutdown_warning = "O seu download vai iniciar, garanta que a funcao\n'Desligamento Automatico' nas configuracoes\ndo seu Xbox 360 esta desativado.",
        auto_shutdown_continue = "Continuar",
        auto_shutdown_cancel = "Cancelar",
        batch_download_complete = "Downloads concluidos!\n\nBaixados: %d / %d\nTempo total: %s\nVelocidade media: %s",
        batch_download_cancelled = "Downloads cancelados.\nBaixados: %d / %d",
        download_list_count = "%d item(ns)",
        credits = "Creditos",
        credits_title = "Creditos",
        credits_msg = "Esse projeto iniciou como um fork do GodSend, projeto esse que mostrou ser possivel colocar uma loja dentro do Xbox 360, um agradecimento especial para o Heavy_Race3173 e Vagus125490 que iniciaram esse caminho e mostraram por onde comecar!"
    },
    en = {
        browse_all = "Browse All Games",
        search = "Search Games",
        browse_platform = "Browse by Platform",
        settings = "Settings",
        about = "About",
        select_platform = "Select Platform",
        install_drive = "Install Drive",
        server = "Server",
        test_connection = "Test Connection",
        dns_guide = "DNS Optimization Guide",
        language = "Language",
        back = "< Back",
        no_network = "No Network",
        no_network_msg = "Your Xbox is not connected to the network.\n\n1. Check your ethernet cable or WiFi\n2. Go to Xbox Settings > Network\n3. Make sure your router is on",
        connection_failed = "Connection Failed",
        connection_ok = "Connection OK!",
        download = "Download",
        download_confirm = "Download: %s?\n\nType: %s\nDestination: %s",
        download_all = "Download All",
        download_all_confirm = "Download all %d files for this game?\n\nDestination: %s",
        downloading = "Downloading: %s...",
        download_complete = "Download Complete",
        download_complete_msg = "Downloaded: %d / %d files\n%sGo to Settings > Content > Scan\nto refresh your library.",
        success = "Success",
        success_msg = "%s downloaded successfully!\n\nGo to Settings > Content > Scan\nto refresh your library.",
        complete = "Complete",
        error = "Error",
        no_results = "No Results",
        no_results_msg = "No games found for: \"%s\"\n\nTry a different search term.",
        empty = "Empty",
        empty_msg = "No games available on the server.\n\nGames need to be added via the admin panel.",
        no_files = "No Files",
        no_files_msg = "No downloadable files found on the server for this entry.",
        no_files_available = "No files available",
        files_separator = ".--- { DOWNLOADS } ---.",
        download_all_btn = ">> Download ALL Files",
        view_description = "View Description",
        publisher_label = "Publisher",
        game_type = "[GAME]",
        dlc_type = "[DLC]",
        update_type = "[TU]",
        translation_type = "[TRANSLATION]",
        file_type = "[FILE]",
        checking_files = "Checking files...",
        loading_games = "Loading games...",
        loading_details = "Loading game details...",
        connecting = "Connecting to GODSend server...",
        select_drive = "Select Install Drive",
        server_url_msg = "Current: %s\n\nEdit GODSend.ini to change the server URL.",
        move_error = "Move Error",
        move_error_msg = "Download OK but could not move file.\n\nFrom: %s\nTo: %s\n\nError: %s\n\nFile saved in temp folder.",
        failed_count = "Failed: %d\n",
        select_language = "Select Language",
        welcome_title = "Welcome!",
        welcome_msg = "Welcome to GodStix!\n\nProduced by SpeedyGamesDownloads\n\nSelect your preferred language.",
        language_changed = "Language changed!",
        dns_title = "DNS Optimization - Cloudflare",
        dns_msg = "For faster and more stable downloads,\nconfigure Cloudflare DNS (1.1.1.1).\n\nON YOUR XBOX 360:\n1. Go to System Settings\n2. Network Settings\n3. Select your connection\n4. Configure Network\n5. DNS Settings > Manual\n6. Primary DNS: 1.1.1.1\n7. Secondary DNS: 1.0.0.1\n\nON YOUR ROUTER (optional):\nChange DNS in router settings\nto 1.1.1.1 and 1.0.0.1\nAll devices will benefit.",
        about_msg = "Browse, search and download Xbox 360 games\ndirectly from your console.\n\nFeatures:\n- Browse all games\n- Search games by name\n- Filter by platform\n- My Games (scan installed games)\n- Download with drive selection\n- Downloaded files badge\n- Multi-language (PT-BR, EN, ES)\n\nDrive: %s",
        games_count = "%d games",
        error_occurred = "An error occurred:\n\n%s\n\nThe script will return to the main menu.",
        error_loading = "Error loading games:\n%s",
        error_details = "Error showing game details:\n%s",
        parse_error = "Parse Error",
        parse_error_msg = "Server returned %d games but parsing failed.\n\nResponse preview:\n%s",
        search_prompt = "Enter the game name",
        keyboard_error = "Keyboard not available:\n%s",
        file_info_error = "Could not get file info from server.\n\nError: %s",
        conn_fail_msg = "Could not connect to the server.\n\nPlease check:\n- Your Xbox is connected to the internet\n- The network cable is plugged in\n- Your router is working\n\nIf the problem persists, contact support.",
        https_warning = "\n\nWarning: The server is configured with HTTPS, which is not supported by Xbox.",
        downloaded_notification = "%s downloaded!",
        file_part = "File %d/%d: %s",
        retry_attempt = "Attempt %d/%d...",
        retry_failed = "Attempt %d/%d failed. Retrying...",
        all_retries_failed = "Download failed after %d attempts.",
        retry_settings = "Download Retries",
        retry_count = "Retries: %s",
        retry_disabled = "Disabled",
        retry_select = "Number of retries (current: %s)",
        retry_off = "Disable retries",
        download_aborted = "Download cancelled.",
        abort_cleanup = "Cancelling...",
        abort_cleanup_1 = "Cancelling...",
        abort_cleanup_2 = "To speed up, restart Aurora.",
        download_time = "Time: %s",
        success_time_msg = "%s downloaded successfully!\nTime: %s\nAverage speed: %s\n\nGo to Settings > Content > Scan\nto refresh your library.",
        download_complete_time_msg = "Downloaded: %d / %d files\n%sTotal time: %s\nAverage speed: %s\n\nGo to Settings > Content > Scan\nto refresh your library.",
        retry_failed_files = "Retry %d failed file(s)?",
        retrying_failed = "Retrying failed files...",
        retry_result = "Retry result:\nDownloaded: %d / %d\n%sTime: %s",
        my_games = "My Games",
        scanning_folders = "Scanning folders...",
        select_scan_drive = "Select device to scan",
        no_titles_found = "No installed games found.\n\nMake sure the 'Content' permission\nis enabled in the script settings.",
        looking_up_titles = "Looking up registered games...",
        not_registered = "Game Not Registered",
        not_registered_msg = "The game with Title ID \"%s\" has not been registered on the platform yet.\n\nIt will be added soon!",
        downloaded_badge = "(Downloaded)",
        installed_badge = " [v]",
        yes = "Yes",
        no = "No",
        my_games_count = "%d games found",
        login_title = "Login",
        login_prompt = "Enter your email or username",
        password_prompt = "Enter your password",
        login_success = "Login successful!",
        login_failed = "Login Failed",
        login_failed_msg = "Invalid email/username or password.\n\nPlease check your credentials and try again.",
        login_error = "Authentication error:\n%s",
        login_info = "Logged in as: %s\nLevel: Lv.%s - %s\nDownloads today: %d / %s",
        login_no_access = "Access Denied",
        login_no_access_msg = "Your access level does not allow using this tool.\n\nCurrent level: %s\n\nPlease contact support.",
        login_required_download = "You need to be logged in to download files.\n\nPlease log in first.",
        download_error_detail = "Error starting download:",
        login_limit_reached = "Download Limit",
        login_limit_msg = "You have reached your daily download limit.\n\nLimit: %d downloads/day\nUsed: %d\n\nTry again tomorrow.",
        login_menu = "My Account",
        logout = "Logout",
        downloads_remaining = "Downloads remaining: %s",
        login_required = "Login Required",
        login_required_msg = "You need to log in to continue.",
        splash_title = "GodStix",
        splash_msg = "GodStix v%s\n\nDownload Xbox 360 games directly to your console!\n\nRegister at www.speedygamesdownloads.com\n\nBecome a member for unlimited downloads!\nMembers get full catalog access.",
        guest_access = "Guest Access (2 downloads/day)",
        guest_login = "Login (Member)",
        register_access = "Register",
        register_msg = "To register, visit the website:\n\nwww.speedygamesdownloads.com\n\nCreate your account and become a member\nfor unlimited downloads!",
        guest_name = "Guest",
        guest_limit_reached = "Guest Limit",
        guest_limit_msg = "You have reached the guest limit of 2 downloads/day.\n\nBecome a member for unlimited downloads!\nspeedygamesdownloads.com",
        verify_installation = "Verify Installation",
        verifying_files = "Verifying installed files...",
        verify_title = "Verification Result",
        verify_ok = "OK",
        verify_missing = "MISSING",
        verify_wrong_size = "WRONG SIZE",
        verify_all_ok = "All files are correct!",
        verify_summary = "Files OK: %d\nMissing: %d\nWrong size: %d",
        verify_redownload = "Re-download %d problematic file(s)?",
        verify_total_downloaded = "Total downloaded",
        verify_no_files = "No files to verify.",
        verify_checking = "Verifying: %s...",
        browse_category = "Browse by Category",
        select_category = "Select Category",
        loading_categories = "Loading categories...",
        no_categories = "No categories available.",
        console_info = "Console Info",
        console_info_title = "Console Information",
        nova_webui = "Install WebUI",
        nova_install = "Install WebUI",
        nova_backup = "Backup Current WebUI",
        nova_update_titles = "Update titles.json",
        nova_no_webuis = "No WebUIs available",
        nova_select_webui = "Select WebUI to Install",
        nova_backup_name = "Backup Name",
        nova_backup_prompt = "Enter a name for the current WebUI",
        nova_backup_exists = "A WebUI with that name already exists.\nPlease use a different name.",
        nova_backup_fail = "Failed to backup current WebUI",
        nova_backup_ok = "Backup successful",
        nova_install_fail_delete = "Failed to remove current web root.\nExiting.",
        nova_install_fail_copy = "Failed to copy custom WebUI into web root.\nExiting.",
        nova_install_ok = "Install successful",
        nova_install_access = "Access the WebUI at:\nhttp://%s:9999",
        nova_update_ask = "Would you like to update titles.json?",
        nova_update_progress = "Updating titles.json",
        nova_update_fail = "Failed to update titles.json",
        nova_update_ok = "Successfully updated titles.json",
        exit_script = "Exit Script",
        download_or_verify = "Download Options",
        download_game = "Download File",
        auto_login_msg = "Reconnecting...",
        auto_login_fail = "Session expired. Please log in again.",
        guest_check_fail = "Guest limit of 2 downloads/day reached.\n\nBecome a member for unlimited downloads!\nspeedygamesdownloads.com",
        console_banned = "Console Banned",
        console_banned_msg = "Your console has been banned from the server.\n\nConsole ID: %s\n\nPlease contact support.",
        retry_connection = "Try Again",
        exit_option = "Exit",
        connection_error_title = "Connection Error",
        already_downloaded = "File Already Downloaded",
        already_downloaded_msg = "The file \"%s\" already exists in the install folder.\n\nDo you want to download again and replace it?",
        restart_aurora = "Restart Aurora",
        restart_aurora_msg = "Download complete!\n\nDo you want to restart Aurora to refresh the games list?",
        no_drives = "No storage devices found.",
        rate_game = "Rating",
        rate_title = "Rate Game",
        how_many_stars = "How many stars?",
        rate_stars = "%d Star(s)",
        rate_success = "Rating submitted!",
        rate_current = "Average: %s stars (%d votes)",
        no_rating = "No ratings",
        add_favorite = "Add to Favorites",
        remove_favorite = "Remove from Favorites",
        favorite_added = "Added to favorites!",
        favorite_removed = "Removed from favorites!",
        my_list = "Favorites",
        no_favorites = "Your favorites are empty.",
        report_item = "Report Item",
        report_title = "What is the problem?",
        report_wrong = "Wrong Item",
        report_corrupted = "Corrupted Item",
        report_success = "Report sent! Thank you.",
        report_error = "Error sending report.",
        account_expires = "Subscription expires in: %d days",
        account_expired = "Subscription expired",
        download_list = "Download List",
        add_to_download_list = "Add to Download List",
        remove_from_download_list = "Remove from Download List",
        added_to_download_list = "\"%s\" added to download list!",
        removed_from_download_list = "\"%s\" removed from download list!",
        already_in_download_list = "\"%s\" is already in the download list.",
        download_list_empty = "The download list is empty.",
        download_all_list = "Download All",
        clear_download_list = "Clear List",
        download_list_cleared = "Download list cleared!",
        auto_shutdown_warning = "Your download is about to start. Please make sure\n'Auto Shutdown' in your Xbox 360 settings\nis turned off.",
        auto_shutdown_continue = "Continue",
        auto_shutdown_cancel = "Cancel",
        batch_download_complete = "Downloads complete!\n\nDownloaded: %d / %d\nTotal time: %s\nAverage speed: %s",
        batch_download_cancelled = "Downloads cancelled.\nDownloaded: %d / %d",
        download_list_count = "%d item(s)",
        credits = "Credits",
        credits_title = "Credits",
        credits_msg = "This project started as a fork of GodSend, a project that showed it was possible to put a store inside the Xbox 360. A special thanks to Heavy_Race3173 and Vagus125490 who started this journey and showed the way forward!"
    },
    es = {
        browse_all = "Ver Todos los Juegos",
        search = "Buscar Juegos",
        browse_platform = "Ver por Plataforma",
        settings = "Configuracion",
        about = "Acerca de",
        select_platform = "Seleccionar Plataforma",
        install_drive = "Unidad de Instalacion",
        server = "Servidor",
        test_connection = "Probar Conexion",
        dns_guide = "Guia de Optimizacion DNS",
        language = "Idioma",
        back = "< Volver",
        no_network = "Sin Red",
        no_network_msg = "Tu Xbox no esta conectado a la red.\n\n1. Verifica el cable ethernet o WiFi\n2. Ve a Configuracion de Xbox > Red\n3. Asegurate que el router esta encendido",
        connection_failed = "Conexion Fallida",
        connection_ok = "Conexion OK!",
        download = "Download",
        download_confirm = "Descargar: %s?\n\nTipo: %s\nDestino: %s",
        download_all = "Descargar Todo",
        download_all_confirm = "Descargar los %d archivos de este juego?\n\nDestino: %s",
        downloading = "Descargando: %s...",
        download_complete = "Descarga Completa",
        download_complete_msg = "Descargados: %d / %d archivos\n%sVe a Configuracion > Contenido > Scan\npara actualizar tu biblioteca.",
        success = "Exito",
        success_msg = "%s descargado con exito!\n\nVe a Configuracion > Contenido > Scan\npara actualizar tu biblioteca.",
        complete = "Completo",
        error = "Error",
        no_results = "Sin Resultados",
        no_results_msg = "No se encontraron juegos para: \"%s\"\n\nIntenta con otro termino.",
        empty = "Vacio",
        empty_msg = "No hay juegos disponibles en el servidor.\n\nLos juegos deben ser agregados por el panel admin.",
        no_files = "Sin Archivos",
        no_files_msg = "No se encontraron archivos descargables en el servidor.",
        no_files_available = "Sin archivos disponibles",
        files_separator = ".--- { DOWNLOADS } ---.",
        download_all_btn = ">> Descargar TODOS los Archivos",
        view_description = "Ver Descripcion",
        publisher_label = "Editor",
        game_type = "[JUEGO]",
        dlc_type = "[DLC]",
        update_type = "[TU]",
        translation_type = "[TRADUCCION]",
        file_type = "[ARCHIVO]",
        checking_files = "Verificando archivos...",
        loading_games = "Cargando juegos...",
        loading_details = "Cargando detalles del juego...",
        connecting = "Conectando al servidor GODSend...",
        select_drive = "Seleccionar Unidad de Instalacion",
        server_url_msg = "Actual: %s\n\nEdita GODSend.ini para cambiar la URL del servidor.",
        move_error = "Error al Mover",
        move_error_msg = "Descarga OK pero no se pudo mover.\n\nDe: %s\nA: %s\n\nError: %s\n\nArchivo guardado en la carpeta temporal.",
        failed_count = "Fallidos: %d\n",
        select_language = "Seleccionar Idioma",
        welcome_title = "Bienvenido!",
        welcome_msg = "Bienvenido a GodStix!\n\nProducido por SpeedyGamesDownloads\n\nSelecciona tu idioma preferido.",
        language_changed = "Idioma cambiado!",
        dns_title = "Optimizacion DNS - Cloudflare",
        dns_msg = "Para descargas mas rapidas y estables,\nconfigura el DNS Cloudflare (1.1.1.1).\n\nEN TU XBOX 360:\n1. Ve a Configuracion del Sistema\n2. Configuracion de Red\n3. Selecciona tu conexion\n4. Configurar Red\n5. Config. DNS > Manual\n6. DNS Primario: 1.1.1.1\n7. DNS Secundario: 1.0.0.1\n\nEN TU ROUTER (opcional):\nCambia el DNS en la configuracion\na 1.1.1.1 y 1.0.0.1\nTodos los dispositivos se beneficiaran.",
        about_msg = "Navega, busca y descarga juegos Xbox 360\ndirectamente desde tu consola.\n\nFunciones:\n- Ver todos los juegos\n- Buscar juegos por nombre\n- Filtrar por plataforma\n- Mis Juegos (analiza juegos instalados)\n- Descarga con seleccion de unidad\n- Badge de archivos descargados\n- Multi-idioma (PT-BR, EN, ES)\n\nUnidad: %s",
        games_count = "%d juegos",
        error_occurred = "Ocurrio un error:\n\n%s\n\nEl script volvera al menu principal.",
        error_loading = "Error al cargar juegos:\n%s",
        error_details = "Error al mostrar detalles:\n%s",
        parse_error = "Error de Analisis",
        parse_error_msg = "El servidor devolvio %d juegos pero el analisis fallo.\n\nVista previa:\n%s",
        search_prompt = "Ingresa el nombre del juego",
        keyboard_error = "Teclado no disponible:\n%s",
        file_info_error = "No se pudo obtener info del archivo.\n\nError: %s",
        conn_fail_msg = "No se pudo conectar al servidor.\n\nVerifica que:\n- Tu Xbox esta conectado a internet\n- El cable de red esta bien conectado\n- El router esta funcionando\n\nSi el problema persiste, contacta con soporte.",
        https_warning = "\n\nAtencion: El servidor esta configurado con HTTPS, que no es soportado por Xbox.",
        downloaded_notification = "%s descargado!",
        file_part = "Archivo %d/%d: %s",
        retry_attempt = "Intento %d/%d...",
        retry_failed = "Intento %d/%d fallido. Reintentando...",
        all_retries_failed = "Descarga fallida despues de %d intentos.",
        retry_settings = "Reintentos de Descarga",
        retry_count = "Reintentos: %s",
        retry_disabled = "Desactivado",
        retry_select = "Numero de reintentos (actual: %s)",
        retry_off = "Desactivar reintentos",
        download_aborted = "Descarga cancelada.",
        abort_cleanup = "Cancelando...",
        abort_cleanup_1 = "Cancelando...",
        abort_cleanup_2 = "Para acelerar, reinicie Aurora.",
        download_time = "Tiempo: %s",
        success_time_msg = "%s descargado con exito!\nTiempo: %s\nVelocidad media: %s\n\nVe a Configuracion > Contenido > Scan\npara actualizar tu biblioteca.",
        download_complete_time_msg = "Descargados: %d / %d archivos\n%sTiempo total: %s\nVelocidad media: %s\n\nVe a Configuracion > Contenido > Scan\npara actualizar tu biblioteca.",
        retry_failed_files = "Reintentar %d archivo(s) que fallaron?",
        retrying_failed = "Reintentando archivos fallidos...",
        retry_result = "Resultado del reintento:\nDescargados: %d / %d\n%sTiempo: %s",
        my_games = "Mis Juegos",
        scanning_folders = "Analizando carpetas...",
        select_scan_drive = "Seleccionar dispositivo para analisis",
        no_titles_found = "No se encontraron juegos instalados.\n\nVerifica que el permiso 'Contenido'\neste activado en la configuracion del script.",
        looking_up_titles = "Consultando juegos registrados...",
        not_registered = "Juego No Registrado",
        not_registered_msg = "El juego con Title ID \"%s\" aun no ha sido registrado en la plataforma.\n\nSera agregado pronto!",
        downloaded_badge = "(Descargado)",
        installed_badge = " [v]",
        yes = "Si",
        no = "No",
        my_games_count = "%d juegos encontrados",
        login_title = "Login",
        login_prompt = "Ingresa tu email o usuario",
        password_prompt = "Ingresa tu contrasena",
        login_success = "Login exitoso!",
        login_failed = "Login Fallido",
        login_failed_msg = "Email/usuario o contrasena incorrectos.\n\nVerifica tus datos e intenta nuevamente.",
        login_error = "Error de autenticacion:\n%s",
        login_info = "Conectado como: %s\nNivel: Lv.%s - %s\nDescargas hoy: %d / %s",
        login_no_access = "Acceso Denegado",
        login_no_access_msg = "Tu nivel de acceso no permite usar esta herramienta.\n\nNivel actual: %s\n\nContacta al soporte.",
        login_required_download = "Necesitas estar conectado para descargar archivos.\n\nInicia sesion primero.",
        download_error_detail = "Error al iniciar descarga:",
        login_limit_reached = "Limite de Descargas",
        login_limit_msg = "Has alcanzado el limite diario de descargas.\n\nLimite: %d descargas/dia\nUsados: %d\n\nIntenta nuevamente manana.",
        login_menu = "Mi Cuenta",
        logout = "Salir",
        downloads_remaining = "Descargas restantes: %s",
        login_required = "Login Necesario",
        login_required_msg = "Necesitas iniciar sesion para continuar.",
        splash_title = "GodStix",
        splash_msg = "GodStix v%s\n\nDescarga juegos de Xbox 360 directo en tu consola!\n\nRegistrate en www.speedygamesdownloads.com\n\nHazte miembro para descargas ilimitadas!\nLos miembros tienen acceso al catalogo completo.",
        guest_access = "Acceso Visitante (2 descargas/dia)",
        guest_login = "Login (Miembro)",
        register_access = "Registro",
        register_msg = "Para registrarte, visita el sitio:\n\nwww.speedygamesdownloads.com\n\nCrea tu cuenta y hazte miembro\npara descargas ilimitadas!",
        guest_name = "Visitante",
        guest_limit_reached = "Limite de Visitante",
        guest_limit_msg = "Has alcanzado el limite de 2 descargas/dia como visitante.\n\nHazte miembro para descargas ilimitadas!\nspeedygamesdownloads.com",
        verify_installation = "Verificar Instalacion",
        verifying_files = "Verificando archivos instalados...",
        verify_title = "Resultado de Verificacion",
        verify_ok = "OK",
        verify_missing = "AUSENTE",
        verify_wrong_size = "TAMANO INCORRECTO",
        verify_all_ok = "Todos los archivos estan correctos!",
        verify_summary = "Archivos OK: %d\nAusentes: %d\nTamano incorrecto: %d",
        verify_redownload = "Descargar nuevamente los %d archivo(s) con problema?",
        verify_total_downloaded = "Total descargado",
        verify_no_files = "No hay archivos para verificar.",
        verify_checking = "Verificando: %s...",
        browse_category = "Ver por Categoria",
        select_category = "Seleccionar Categoria",
        loading_categories = "Cargando categorias...",
        no_categories = "No hay categorias disponibles.",
        console_info = "Info de Consola",
        console_info_title = "Informacion de Consola",
        nova_webui = "Instalar WebUI",
        nova_install = "Instalar WebUI",
        nova_backup = "Hacer Backup de WebUI Actual",
        nova_update_titles = "Actualizar titles.json",
        nova_no_webuis = "No hay WebUIs disponibles",
        nova_select_webui = "Seleccionar WebUI para Instalar",
        nova_backup_name = "Nombre del Backup",
        nova_backup_prompt = "Ingrese un nombre para la WebUI actual",
        nova_backup_exists = "Ya existe una WebUI con ese nombre.\nElija otro nombre.",
        nova_backup_fail = "Fallo al hacer backup de la WebUI actual",
        nova_backup_ok = "Backup realizado con exito",
        nova_install_fail_delete = "Fallo al eliminar la WebUI actual.\nSaliendo.",
        nova_install_fail_copy = "Fallo al copiar la WebUI al destino.\nSaliendo.",
        nova_install_ok = "Instalacion completada con exito",
        nova_install_access = "Acceda a la WebUI en:\nhttp://%s:9999",
        nova_update_ask = "Desea actualizar el titles.json?",
        nova_update_progress = "Actualizando titles.json",
        nova_update_fail = "Fallo al actualizar titles.json",
        nova_update_ok = "titles.json actualizado con exito",
        exit_script = "Finalizar Script",
        download_or_verify = "Opciones de Descarga",
        download_game = "Descargar Archivo",
        auto_login_msg = "Reconectando...",
        auto_login_fail = "Sesion expirada. Inicia sesion nuevamente.",
        guest_check_fail = "Limite de 2 descargas/dia alcanzado.\n\nHazte miembro para descargas ilimitadas!\nspeedygamesdownloads.com",
        console_banned = "Consola Baneada",
        console_banned_msg = "Tu consola ha sido baneada del servidor.\n\nConsole ID: %s\n\nContacta con soporte.",
        retry_connection = "Intentar de Nuevo",
        exit_option = "Salir",
        connection_error_title = "Error de Conexion",
        already_downloaded = "Archivo Ya Descargado",
        already_downloaded_msg = "El archivo \"%s\" ya existe en la carpeta de instalacion.\n\nDesea descargarlo nuevamente y reemplazarlo?",
        restart_aurora = "Reiniciar Aurora",
        restart_aurora_msg = "Descarga completada!\n\nDesea reiniciar Aurora para actualizar la lista de juegos?",
        no_drives = "No se encontraron dispositivos de almacenamiento.",
        rate_game = "Calificacion",
        rate_title = "Calificar Juego",
        how_many_stars = "Cuantas estrellas?",
        rate_stars = "%d Estrella(s)",
        rate_success = "Calificacion enviada!",
        rate_current = "Promedio: %s estrellas (%d votos)",
        no_rating = "Sin calificaciones",
        add_favorite = "Agregar a Favoritos",
        remove_favorite = "Quitar de Favoritos",
        favorite_added = "Agregado a favoritos!",
        favorite_removed = "Quitado de favoritos!",
        my_list = "Favoritos",
        no_favorites = "Tus favoritos estan vacios.",
        report_item = "Reportar Item",
        report_title = "Cual es el problema?",
        report_wrong = "Item Incorrecto",
        report_corrupted = "Item Corrupto",
        report_success = "Reporte enviado! Gracias.",
        report_error = "Error al enviar reporte.",
        account_expires = "Suscripcion expira en: %d dias",
        account_expired = "Suscripcion expirada",
        download_list = "Lista de Descargas",
        add_to_download_list = "Agregar a Lista de Descargas",
        remove_from_download_list = "Quitar de Lista de Descargas",
        added_to_download_list = "\"%s\" agregado a la lista de descargas!",
        removed_from_download_list = "\"%s\" quitado de la lista de descargas!",
        already_in_download_list = "\"%s\" ya esta en la lista de descargas.",
        download_list_empty = "La lista de descargas esta vacia.",
        download_all_list = "Descargar Todos",
        clear_download_list = "Limpiar Lista",
        download_list_cleared = "Lista de descargas limpia!",
        auto_shutdown_warning = "Tu descarga esta por comenzar. Asegurate de que\nla funcion 'Apagado Automatico' en la configuracion\nde tu Xbox 360 este desactivada.",
        auto_shutdown_continue = "Continuar",
        auto_shutdown_cancel = "Cancelar",
        batch_download_complete = "Descargas completadas!\n\nDescargados: %d / %d\nTiempo total: %s\nVelocidad media: %s",
        batch_download_cancelled = "Descargas canceladas.\nDescargados: %d / %d",
        download_list_count = "%d elemento(s)",
        credits = "Creditos",
        credits_title = "Creditos",
        credits_msg = "Este proyecto comenzo como un fork de GodSend, un proyecto que demostro que era posible poner una tienda dentro del Xbox 360. Un agradecimiento especial para Heavy_Race3173 y Vagus125490 que iniciaron este camino y mostraron por donde empezar!"
    }
}

local function L(key)
    local lang = STRINGS[gCurrentLang]
    if lang and lang[key] then return lang[key] end
    local fallback = STRINGS["en"]
    if fallback and fallback[key] then return fallback[key] end
    return key
end

local function getLangName(code)
    for _, lang in ipairs(LANGUAGES) do
        if lang.code == code then return lang.name end
    end
    return code
end

local function getTime()
    local ok, t = pcall(Aurora.GetTime)
    if ok and t then
        return (t.Hour or 0) * 3600 + (t.Minute or 0) * 60 + (t.Second or 0)
    end
    return 0
end

local function formatSpeed(bytesPerSec)
    if not bytesPerSec or bytesPerSec <= 0 then return "0 B/s" end
    if bytesPerSec >= 1048576 then
        return string.format("%.2f MB/s", bytesPerSec / 1048576)
    elseif bytesPerSec >= 1024 then
        return string.format("%.2f KB/s", bytesPerSec / 1024)
    end
    return string.format("%.0f B/s", bytesPerSec)
end

local function formatTime(seconds)
    if not seconds or seconds < 0 then seconds = 0 end
    seconds = math.floor(seconds)
    if seconds < 60 then
        return seconds .. "s"
    elseif seconds < 3600 then
        local m = math.floor(seconds / 60)
        local s = seconds % 60
        return string.format("%dm %02ds", m, s)
    else
        local h = math.floor(seconds / 3600)
        local m = math.floor((seconds % 3600) / 60)
        local s = seconds % 60
        return string.format("%dh %02dm %02ds", h, m, s)
    end
end

local function formatSize(bytes)
    if not bytes or bytes < 0 then return "0 KB" end
    if bytes >= 953482035 then
        return string.format("%.2f GB", bytes / 1073741824)
    elseif bytes >= 1048576 then
        return string.format("%.2f MB", bytes / 1048576)
    else
        return string.format("%.2f KB", bytes / 1024)
    end
end

local function safeLen(t)
    if not t then return 0 end
    local count = 0
    for _ in ipairs(t) do count = count + 1 end
    return count
end

local function safeUrlEncode(str)
    if not str then return "" end
    local okEnc, encoded = pcall(function()
        return Http.UrlEncode(str)
    end)
    if okEnc and encoded then return encoded end
    local result = string.gsub(str, "([^%w%-%.%_%~ ])", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
    result = string.gsub(result, " ", "+")
    return result
end

local function httpGet(url)
    local ok, r = pcall(Http.Get, url)
    if not ok then
        return nil, "pcall failed: " .. tostring(r)
    end
    if not r then
        return nil, "No response object (nil)"
    end
    if not r.Success then
        local detail = "HTTP " .. tostring(r.StatusCode or "?")
        if r.StatusDescription then
            detail = detail .. " (" .. tostring(r.StatusDescription) .. ")"
        end
        if r.OutputData and type(r.OutputData) == "string" and string.len(r.OutputData) > 0 then
            local preview = r.OutputData
            if string.len(preview) > 200 then
                preview = string.sub(preview, 1, 200) .. "..."
            end
            detail = detail .. "\nResponse: " .. preview
        end
        return nil, detail
    end

    local data = r.OutputData
    if not data then
        return nil, "Response Success but OutputData is nil"
    end
    if type(data) ~= "string" then
        return nil, "Response OutputData is not a string (type: " .. type(data) .. ")"
    end
    if string.len(data) == 0 then
        return nil, "Response OutputData is empty"
    end

    local firstChar = string.sub(data, 1, 1)
    if firstChar ~= "{" and firstChar ~= "[" then
        local preview = data
        if string.len(preview) > 100 then
            preview = string.sub(preview, 1, 100)
        end
        return nil, "Response is not JSON (starts with: " .. preview .. ")\nPossible gzip compression. Check server config."
    end

    return data, nil
end

local function encodeURIComponent(str)
    if not str then return "" end
    return str:gsub("([^%w%-%.%_%~%/])", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
end

local function jsonField(json, field)
    if not json or type(json) ~= "string" then return nil end
    local ok, result = pcall(function()
        return json:match('"' .. field .. '"%s*:%s*"([^"]*)"')
    end)
    if ok then return result end
    return nil
end

local function jsonFieldBoolean(json, field)
    if not json or type(json) ~= "string" then return nil end
    local ok, result = pcall(function()
        return json:match('"' .. field .. '"%s*:%s*(true)')
    end)
    if ok and result then return true end
    local ok2, result2 = pcall(function()
        return json:match('"' .. field .. '"%s*:%s*(false)')
    end)
    if ok2 and result2 then return false end
    return nil
end

local function jsonFieldNumber(json, field)
    if not json or type(json) ~= "string" then return nil end
    local ok, result = pcall(function()
        return json:match('"' .. field .. '"%s*:%s*(-?%d+%.?%d*)')
    end)
    if ok and result then return tonumber(result) end
    return nil
end

local function jsonFieldBool(json, field)
    if not json or type(json) ~= "string" then return nil end
    local ok, result = pcall(function()
        return json:match('"' .. field .. '"%s*:%s*(%a+)')
    end)
    if ok and result then
        if result == "true" then return true end
        if result == "false" then return false end
    end
    return nil
end

local function parseJsonArray(json, arrayField)
    if not json or type(json) ~= "string" then return {} end
    local ok, result = pcall(function()
        local startPos = json:find('"' .. arrayField .. '"%s*:%s*%[')
        if not startPos then return {} end
        local arrStart = json:find('%[', startPos)
        if not arrStart then return {} end

        local items = {}
        local depth = 0
        local objStart = nil
        local jsonLen = string.len(json)
        for i = arrStart + 1, jsonLen do
            local c = json:sub(i, i)
            if c == '{' then
                if depth == 0 then objStart = i end
                depth = depth + 1
            elseif c == '}' then
                depth = depth - 1
                if depth == 0 and objStart then
                    table.insert(items, json:sub(objStart + 1, i - 1))
                    objStart = nil
                end
            elseif c == ']' and depth == 0 then
                break
            end
        end
        return items
    end)
    if ok and result then return result end
    return {}
end

local function saveSetting(key, value)
    pcall(function()
        local ini = IniFile.LoadFile("GODSend.ini")
        if ini then
            ini:WriteValue("Settings", key, value)
            ini:SaveFile("GODSend.ini")
        end
    end)
end

local function saveLanguage(langCode)
    saveSetting("Language", langCode)
end

local function loadSettings()
    local ok, ini = pcall(IniFile.LoadFile, "GODSend.ini")
    if ok and ini then
        local url = ini:ReadValue("Settings", "ServerURL", "")
        if url ~= "" then
            url = string.gsub(url, "^https://", "http://")
            if string.sub(url, -1) == "/" then
                url = string.sub(url, 1, string.len(url) - 1)
            end
            SERVER_URL = url
            API_BASE = url .. "/api"
        end
        local drive = ini:ReadValue("Settings", "InstallDrive", "")
        if drive ~= "" then gInstallDrive = drive end
        local lang = ini:ReadValue("Settings", "Language", "")
        if lang ~= "" then gCurrentLang = lang end
        local retries = ini:ReadValue("Settings", "MaxRetries", "")
        if retries ~= "" then
            local n = tonumber(retries)
            if n then gMaxAttempts = n end
        end
        local myDrive = ini:ReadValue("Settings", "MyGamesDrive", "")
        if myDrive ~= "" then gMyGamesDrive = myDrive end
    end
end

local function isFirstRun()
    local ok, ini = pcall(IniFile.LoadFile, "GODSend.ini")
    if ok and ini then
        local lang = ini:ReadValue("Settings", "Language", "")
        return lang == ""
    end
    return true
end

local function showLanguageSelection(firstRun)
    Menu.ResetMenu()
    Menu.SetTitle(L("select_language"))
    Menu.SetExitOnCancel(false)
    Menu.SetGoBackText(L("back"))

    for _, lang in ipairs(LANGUAGES) do
        local label = lang.name
        if lang.code == gCurrentLang then
            label = label .. " *"
        end
        Menu.AddMainMenuItem(Menu.MakeMenuItem(label, lang.code))
    end

    local langResult, _, langCanceled = Menu.ShowMainMenu()
    if not langCanceled and langResult then
        gCurrentLang = langResult
        saveLanguage(langResult)
        if firstRun then
            Script.ShowNotification(L("welcome_title"))
        else
            Script.ShowNotification(L("language_changed"))
        end
        return true
    end
    return false
end

function HttpProgressRoutine(dwTotalFileSize, dwTotalBytesTransferred, dwReason)
    if gAbortedOperation then
        local now = getTime()
        if now - gAbortLastToggleTime >= 1 then
            gAbortShowHint = not gAbortShowHint
            gAbortLastToggleTime = now
        end
        if gAbortShowHint then
            Script.SetStatus(L("abort_cleanup_2"))
        else
            Script.SetStatus(L("abort_cleanup_1"))
        end
        return 0
    end

    local ok, result = pcall(function()
        if Script.IsCanceled() then
            gAbortedOperation = true
            gAbortShowHint = false
            gAbortLastToggleTime = getTime()
            Script.SetStatus(L("abort_cleanup_1"))
            pcall(function()
                if gCurrentFileId ~= "" then
                    local abortUrl = API_BASE .. "/download/abort?file_id=" .. tostring(gCurrentFileId)
                        .. "&console_id=" .. safeUrlEncode(gConsoleId)
                        .. "&download_id=" .. tostring(gCurrentDownloadId or "")
                    httpGet(abortUrl)
                end
            end)
            return 0
        end

        local totalSize = dwTotalFileSize or 0
        local transferred = dwTotalBytesTransferred or 0

        local displayTotal = totalSize
        if displayTotal <= 0 and gKnownFileSize > 0 then
            displayTotal = gKnownFileSize
        end

        if displayTotal > 0 then
            Script.SetProgress(transferred, displayTotal)
        else
            Script.SetProgress(transferred, totalSize)
        end

        local now = getTime()
        if now > gLastProgressUpdate then
            local elapsed = now - gDownloadStartTime
            if elapsed < 1 then elapsed = 1 end

            local speedBytes = transferred / elapsed
            local speedStr = formatSize(speedBytes) .. "/s"
            local downloadedStr = formatSize(transferred)
            local timeStr = formatTime(elapsed)

            local partPrefix = ""
            if gTotalParts > 1 then
                partPrefix = "[" .. gCurrentPart .. "/" .. gTotalParts .. "] "
            end

            local status = ""
            if displayTotal > 0 then
                status = partPrefix .. downloadedStr .. " / " .. formatSize(displayTotal) .. " | " .. speedStr .. " | " .. timeStr
            else
                status = partPrefix .. downloadedStr .. " | " .. speedStr .. " | " .. timeStr
            end

            Script.SetStatus(status)
            gLastProgressUpdate = now

        end
        return 0
    end)

    if not ok then
        gAbortedOperation = true
        return 0
    end

    return result or 0
end

local function testConnection()
    while true do
        local testUrl = API_BASE .. "/games?limit=1"
        Script.SetStatus(L("connecting"))
        local data, err = httpGet(testUrl)
        if data then
            Script.SetStatus("")
            return true
        end

        Script.SetStatus("")
        local isHttps = string.find(SERVER_URL, "https://") ~= nil
        local hint = ""
        if isHttps then
            hint = L("https_warning")
        end

        Menu.ResetMenu()
        Menu.SetTitle(L("connection_error_title"))
        Menu.SetExitOnCancel(true)
        Menu.SetGoBackText("")
        Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("retry_connection"), "retry"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("exit_option"), "exit"))

        local msg = L("conn_fail_msg") .. hint
        Script.ShowMessageBox(L("connection_failed"), msg, "OK")

        local retryResult, _, retryCanceled = Menu.ShowMainMenu()
        if retryCanceled or not retryResult or retryResult == "exit" then
            return false
        end
    end
end

local function fetchCategories()
    Script.SetStatus(L("loading_categories"))
    local url = API_BASE .. "/categories"
    local data, err = httpGet(url)
    if not data then return {} end

    local categories = {}
    local catArray = parseJsonArray(data, "categories")
    if safeLen(catArray) == 0 then return {} end

    for _, obj in ipairs(catArray) do
        local wrapped = "{" .. obj .. "}"
        local value = jsonField(wrapped, "value")
        local label = jsonField(wrapped, "label")
        if value and label then
            table.insert(categories, { value = value, label = label })
        end
    end
    return categories
end

local function fetchGames(searchTerm, platform, category)
    local url = API_BASE .. "/games?limit=500"
    if searchTerm and searchTerm ~= "" then
        url = url .. "&search=" .. safeUrlEncode(searchTerm)
    end
    if platform and platform ~= "" then
        url = url .. "&platform=" .. safeUrlEncode(platform)
    end
    if category and category ~= "" then
        url = url .. "&category=" .. safeUrlEncode(category)
    end

    Script.SetStatus(L("loading_games"))
    local data, err = httpGet(url)
    if not data then
        Script.ShowMessageBox(L("error"), "URL: " .. url .. "\n\n" .. (err or "Unknown"), "OK")
        return {}
    end

    local games = {}
    local gameObjects = parseJsonArray(data, "games")

    if safeLen(gameObjects) == 0 then
        local total = jsonFieldNumber(data, "total")
        if total and total > 0 then
            Script.ShowMessageBox(L("parse_error"),
                string.format(L("parse_error_msg"), total, string.sub(data, 1, 300)), "OK")
        end
        return games
    end

    for _, obj in ipairs(gameObjects) do
        local wrapped = "{" .. obj .. "}"
        local id = jsonFieldNumber(wrapped, "id")
        local title = jsonField(wrapped, "title")
        local plat = jsonField(wrapped, "platform")

        if id and title then
            table.insert(games, {
                id = id,
                title = title,
                platform = plat or "xbox360"
            })
        end
    end

    return games
end

local function extractGameObject(json)
    if not json or type(json) ~= "string" then return nil end
    local ok, result = pcall(function()
        local startPos = json:find('"game"%s*:%s*%{')
        if not startPos then return nil end
        local objStart = json:find('%{', startPos)
        if not objStart then return nil end

        local depth = 0
        local jsonLen = string.len(json)
        for i = objStart, jsonLen do
            local c = json:sub(i, i)
            if c == '{' then depth = depth + 1
            elseif c == '}' then
                depth = depth - 1
                if depth == 0 then
                    return json:sub(objStart, i)
                end
            end
        end
        return nil
    end)
    if ok then return result end
    return nil
end

local function fetchGameDetails(gameId)
    local url = API_BASE .. "/games/" .. tostring(gameId)
    Script.SetStatus(L("loading_details"))
    local data, err = httpGet(url)
    if not data then
        Script.ShowMessageBox(L("error"), (err or "Unknown"), "OK")
        return nil
    end

    local gameStr = extractGameObject(data)
    if not gameStr then
        Script.ShowMessageBox(L("error"), string.sub(data, 1, 300), "OK")
        return nil
    end

    local game = {
        id = jsonFieldNumber(gameStr, "id"),
        title = jsonField(gameStr, "title"),
        description = jsonField(gameStr, "description"),
        publisher = jsonField(gameStr, "publisher"),
        platform = jsonField(gameStr, "platform"),
        title_id = jsonField(gameStr, "title_id") or "",
        avg_rating = jsonFieldNumber(gameStr, "avg_rating") or 0,
        total_votes = jsonFieldNumber(gameStr, "total_votes") or 0
    }

    game.files = {}
    local fileObjects = parseJsonArray(gameStr, "files")
    for _, obj in ipairs(fileObjects) do
        local wrapped = "{" .. obj .. "}"
        local fileTitleId = jsonField(wrapped, "title_id") or ""
        if fileTitleId == "" then fileTitleId = game.title_id end
        local file = {
            id = jsonFieldNumber(wrapped, "id"),
            label = jsonField(wrapped, "label") or "File",
            file_type = jsonField(wrapped, "file_type") or "game",
            server_path = jsonField(wrapped, "server_path") or "",
            folder_path = jsonField(wrapped, "folder_path") or "",
            title_id = fileTitleId,
            file_size = jsonFieldNumber(wrapped, "file_size")
        }
        table.insert(game.files, file)
    end

    return game
end

local function buildInstallPath(folderPath, titleId, fileType)
    local dest = ""
    if folderPath and folderPath ~= "" then
        dest = folderPath:gsub("/", "\\")
    elseif titleId and titleId ~= "" then
        dest = "Content\\0000000000000000\\" .. titleId
    end
    if dest ~= "" and dest:sub(-1) ~= "\\" then
        dest = dest .. "\\"
    end
    return dest
end

local function fetchFileInfo(fileId)
    local url = API_BASE .. "/download/" .. tostring(fileId) .. "/info"
    local data, err = httpGet(url)
    if not data then return nil, err end

    local decodeOk, parsed = pcall(function() return json:decode(data) end)
    if decodeOk and parsed and type(parsed) == "table" and parsed.total_files ~= nil then
        if parsed.error then
            return nil, tostring(parsed.error)
        end

        local totalFiles = tonumber(parsed.total_files)
        if not totalFiles then return nil, "Could not parse file info" end

        local directDownload = (parsed.direct_download == true)
        local failedDirs = tonumber(parsed.failed_dirs) or 0

        local fileList = {}
        local hasSubPaths = false
        if totalFiles > 0 and parsed.files and type(parsed.files) == "table" then
            for _, f in ipairs(parsed.files) do
                if type(f) == "table" then
                    local idx = tonumber(f.index)
                    local name = f.name
                    local size = tonumber(f.size) or 0
                    local relPath = f.relative_path or ""
                    local directUrl = f.direct_url or ""
                    if idx ~= nil and name then
                        if relPath ~= "" then hasSubPaths = true end
                        table.insert(fileList, { index = idx, name = tostring(name), size = size, relative_path = tostring(relPath), direct_url = tostring(directUrl) })
                    end
                end
            end
        end

        if totalFiles > 0 and safeLen(fileList) == 0 then
            Script.ShowNotification("[!] FileInfo: server=" .. tostring(totalFiles) .. " files, parsed=0")
        elseif totalFiles ~= safeLen(fileList) then
            Script.ShowNotification("[!] FileInfo: server=" .. tostring(totalFiles) .. " parsed=" .. tostring(safeLen(fileList)))
        end

        return { total = totalFiles, files = fileList, hasSubPaths = hasSubPaths, directDownload = directDownload, failedDirs = failedDirs }
    end

    return nil, "Could not parse file info (JSON decode failed)"
end

local function truncateFileName(name, maxLen)
    if not name or name == "" then return "download" end
    if string.len(name) <= maxLen then return name end
    local ext = string.match(name, "%.([^%.]+)$")
    if ext then
        local base = string.sub(name, 1, maxLen - string.len(ext) - 1)
        return base .. "." .. ext
    end
    return string.sub(name, 1, maxLen)
end

local function getFileSize(filePath)
    local ok, size = pcall(function()
        local info = FileSystem.GetFileInfo(filePath)
        if info and info.Size then return info.Size end
        return 0
    end)
    if ok and size and size > 0 then return size end
    local ok2, size2 = pcall(function()
        return FileSystem.GetFileSize(filePath)
    end)
    if ok2 and size2 and size2 > 0 then return size2 end
    local ok3, size3 = pcall(function()
        local f = io.open(filePath, "rb")
        if f then
            local s = f:seek("end")
            f:close()
            return s or 0
        end
        return 0
    end)
    if ok3 and size3 and size3 > 0 then return size3 end
    return 0
end

local function fileExists(filePath)
    local ok, exists = pcall(function()
        return FileSystem.FileExists(filePath)
    end)
    if ok and exists then return true end
    local ok2, info = pcall(function()
        return FileSystem.GetFileInfo(filePath)
    end)
    if ok2 and info then return true end
    return false
end

local function shortTempName()
    gTempDownloadCounter = gTempDownloadCounter + 1
    return "t" .. tostring(gTempDownloadCounter) .. ".tmp"
end

local function shortFinalName(originalName, maxLen)
    if not originalName or originalName == "" then return "dl" end
    local ext = string.match(originalName, "%.([^%.]+)$")
    if ext then
        if string.len(ext) > 4 then ext = string.sub(ext, 1, 4) end
        local base = string.match(originalName, "^(.+)%.[^%.]+$") or originalName
        base = string.gsub(base, '[<>:"/|%?%*%[%]%s]', "")
        local maxBase = maxLen - string.len(ext) - 1
        if maxBase < 1 then maxBase = 1 end
        if string.len(base) > maxBase then
            base = string.sub(base, 1, maxBase)
        end
        if base == "" then base = "dl" end
        return base .. "." .. ext
    else
        local base = string.gsub(originalName, '[<>:"/|%?%*%[%]%s]', "")
        if string.len(base) > maxLen then
            base = string.sub(base, 1, maxLen)
        end
        if base == "" then base = "dl" end
        return base
    end
end

local function downloadSingleFile(url, fileName, destRelative, expectedSize, preserveName)
    local displayName = truncateFileName(fileName or "download", 42)

    local tmpName = shortTempName()
    local tempRelDir = TEMP_FOLDER .. "\\"
    local tempRelFile = TEMP_FOLDER .. "\\" .. tmpName
    local basePath = Script.GetBasePath()
    local tempAbsDir = basePath .. TEMP_FOLDER .. "\\"
    local tempAbsFile = basePath .. tempRelFile

    pcall(FileSystem.CreateDirectory, tempAbsDir)

    local maxTries = gMaxAttempts
    if maxTries < 1 then maxTries = 1 end
    if maxTries < 3 then maxTries = 3 end

    local success = false
    local lastErr = "unknown"
    local totalElapsed = 0

    for attempt = 1, maxTries do
        gCurrentAttempt = attempt

        if maxTries > 1 then
            Script.SetStatus(string.format(L("retry_attempt"), attempt, maxTries) .. " " .. displayName)
        else
            Script.SetStatus(string.format(L("downloading"), displayName))
        end

        gAbortedOperation = false
        gDownloadStartTime = getTime()
        gLastProgressUpdate = 0
        gKnownFileSize = expectedSize or 0

        local urlPreview = string.sub(url or "", 1, 80)
        local urlProto = "HTTP"
        if url and string.sub(url, 1, 5) == "https" then urlProto = "HTTPS" end

        local dlOk, dlRes
        if gUseFastDownload then
            Script.SetStatus("Baixando (modo rapido, sem progresso)... " .. displayName)
            dlOk, dlRes = pcall(Http.Get, url, tempRelFile)
        else
            Script.ShowNotification(string.format(L("downloading"), displayName))
            dlOk, dlRes = pcall(Http.GetEx, url, HttpProgressRoutine, tempRelFile)
        end

        local elapsed = getTime() - gDownloadStartTime
        totalElapsed = totalElapsed + (elapsed or 0)

        Script.SetProgress(0, 0)
        Script.SetStatus("")

        if gAbortedOperation then
            pcall(FileSystem.DeleteFile, tempAbsFile)
            return false, "cancelled", totalElapsed
        end

        local dlSuccess = dlOk and dlRes
        if gUseFastDownload and dlOk and type(dlRes) == "table" then
            dlSuccess = dlRes.Success
        end

        if dlSuccess then
            if expectedSize and expectedSize > 0 then
                local actualSize = getFileSize(tempAbsFile)
                if actualSize > 0 and actualSize < expectedSize then
                    pcall(FileSystem.DeleteFile, tempAbsFile)
                    lastErr = "incomplete"
                    if attempt < maxTries then
                        Script.ShowNotification(string.format(L("retry_failed"), attempt, maxTries))
                    end
                else
                    success = true
                    break
                end
            else
                success = true
                break
            end
        else
            pcall(FileSystem.DeleteFile, tempAbsFile)
            lastErr = "download error: " .. tostring(dlRes or "failed")
            local httpsWarn = ""
            if url and string.sub(url, 1, 5) == "https" then
                httpsWarn = "\n\n[!] URL usa HTTPS - Aurora NAO suporta HTTPS!"
            end
            if url and string.find(url, "drive.quotaless") then
                httpsWarn = httpsWarn .. "\n[!] URL aponta para Quotaless (redireciona HTTP->HTTPS)"
            end
            if attempt >= maxTries then
                Script.ShowMessageBox(L("error"), L("error") .. "\n\n" .. tostring(dlRes or "failed") .. httpsWarn, "OK")
            end
            if attempt < maxTries then
                Script.ShowNotification(string.format(L("retry_failed"), attempt, maxTries))
            end
        end
    end

    if not success then
        if maxTries > 1 then
            Script.ShowNotification(string.format(L("all_retries_failed"), maxTries) .. " " .. tostring(lastErr))
        end
        return false, lastErr, totalElapsed
    end

    local actualFileSize = getFileSize(tempAbsFile) or 0

    local safeName = string.gsub(fileName or "download", '[<>:"/|%?%*%[%]]', "_")
    if not preserveName then
        safeName = shortFinalName(safeName, 12)
    end

    local renamedAbsFile = tempAbsDir .. safeName
    if tempAbsFile ~= renamedAbsFile then
        local renOk = pcall(FileSystem.MoveFile, tempAbsFile, renamedAbsFile, true)
        if not renOk then
            renamedAbsFile = tempAbsFile
            safeName = tmpName
        end
    end

    if destRelative ~= "" then
        local currentPath = gInstallDrive .. "\\"
        pcall(FileSystem.CreateDirectory, currentPath)
        for folder in destRelative:gmatch("[^\\]+") do
            currentPath = currentPath .. folder .. "\\"
            pcall(FileSystem.CreateDirectory, currentPath)
        end

        local destFull = gInstallDrive .. "\\" .. destRelative .. safeName

        local moveOk, moveErr = pcall(FileSystem.MoveFile, renamedAbsFile, destFull, true)
        if not moveOk then
            local copyOk, copyErr = pcall(FileSystem.CopyFile, renamedAbsFile, destFull, true)
            if copyOk then
                pcall(FileSystem.DeleteFile, renamedAbsFile)
            else
                Script.ShowMessageBox(L("move_error"),
                    string.format(L("move_error_msg"), renamedAbsFile, destFull, tostring(copyErr)), "OK")
            end
        end
    else
        local destFull = gInstallDrive .. "\\" .. safeName
        local moveOk = pcall(FileSystem.MoveFile, renamedAbsFile, destFull, true)
        if not moveOk then
            local copyOk, copyErr = pcall(FileSystem.CopyFile, renamedAbsFile, destFull, true)
            if copyOk then
                pcall(FileSystem.DeleteFile, renamedAbsFile)
            end
        end
    end

    return true, nil, totalElapsed, actualFileSize
end

local function getAuthParam()
    local params = ""
    if gLoggedIn and gUserId > 0 then
        params = "&wp_user_id=" .. tostring(gUserId)
    end
    if gConsoleId ~= "" then
        params = params .. "&console_id=" .. safeUrlEncode(gConsoleId)
    end
    return params
end

local function checkDownloadLimit()
    if gGuestMode then
        if gDownloadsRemaining <= 0 then
            Script.ShowMessageBox(L("guest_limit_reached"), L("guest_limit_msg"), "OK")
            return false
        end
        return true
    end
    if not gLoggedIn then
        Script.ShowMessageBox(L("error"), L("login_required_download"), "OK")
        return false
    end
    if gDailyLimit > 0 and gDownloadsRemaining <= 0 then
        Script.ShowMessageBox(L("login_limit_reached"),
            string.format(L("login_limit_msg"), gDailyLimit, gDownloadsToday), "OK")
        return false
    end
    return true
end

local function reportDownload(fileId, status, bytes, speed, totalSize, fileName, gameTitle, downloadId)
    pcall(function()
        local url = API_BASE .. "/download/report?file_id=" .. tostring(fileId)
            .. "&status=" .. tostring(status)
            .. "&bytes=" .. tostring(bytes or 0)
            .. "&speed=" .. tostring(speed or 0)
            .. "&total_size=" .. tostring(totalSize or 0)
            .. "&file_name=" .. safeUrlEncode(fileName or "")
            .. "&game_title=" .. safeUrlEncode(gameTitle or "")
            .. "&download_id=" .. tostring(downloadId or "")
            .. getAuthParam()
        httpGet(url)
    end)
end

local function checkGuestCanDownload()
    if gConsoleId == "" then return true end
    local url = API_BASE .. "/guest/check?console_id=" .. safeUrlEncode(gConsoleId)
    local data, err = httpGet(url)
    if not data then return true end
    local isBanned = jsonFieldBool(data, "banned")
    if isBanned then
        Script.ShowMessageBox(L("console_banned"),
            string.format(L("console_banned_msg"), gConsoleId), "OK")
        return false
    end
    local canDl = jsonFieldBool(data, "can_download")
    if canDl == false then
        Script.ShowMessageBox(L("guest_limit_reached"),
            L("guest_check_fail"), "OK")
        return false
    end
    return true
end

local function trackGuestDownload()
    if gConsoleId == "" then return end
    local url = API_BASE .. "/guest/track?console_id=" .. safeUrlEncode(gConsoleId)
    pcall(httpGet, url)
end

local function downloadFile(fileId, fileName, folderPath, titleId, fileType, fileSize)
    if not checkDownloadLimit() then return false, 0 end

    local destRelative = buildInstallPath(folderPath, titleId, fileType)

    Script.SetStatus(L("checking_files"))
    local info, infoErr
    local INFO_MAX_ATTEMPTS = 5
    local INFO_RETRY_DELAY_SEC = 3
    local lastPartialInfo = nil
    for infoAttempt = 1, INFO_MAX_ATTEMPTS do
        info, infoErr = fetchFileInfo(fileId)
        if info then
            if info.failedDirs and info.failedDirs > 0 then
                lastPartialInfo = info
                info = nil
                if infoAttempt < INFO_MAX_ATTEMPTS then
                    Script.SetStatus(L("checking_files") .. " (" .. (infoAttempt + 1) .. "/" .. INFO_MAX_ATTEMPTS .. ")")
                    Script.ShowNotification("[!] " .. tostring(lastPartialInfo.failedDirs) .. " pasta(s) incompleta(s), tentando novamente...")
                    local waitStart = getTime()
                    local elapsed = 0
                    while elapsed < INFO_RETRY_DELAY_SEC and elapsed >= 0 do
                        elapsed = getTime() - waitStart
                    end
                end
            else
                break
            end
        else
            if infoAttempt < INFO_MAX_ATTEMPTS then
                Script.SetStatus(L("checking_files") .. " (" .. (infoAttempt + 1) .. "/" .. INFO_MAX_ATTEMPTS .. ")")
                local waitStart = getTime()
                local elapsed = 0
                while elapsed < 2 and elapsed >= 0 do
                    elapsed = getTime() - waitStart
                end
            end
        end
    end

    if not info and lastPartialInfo then
        local answer = Script.ShowMessageBox(L("download"),
            tostring(lastPartialInfo.failedDirs) .. " pasta(s) nao carregaram. Continuar com " .. tostring(lastPartialInfo.total) .. " arquivo(s) encontrado(s)?", "Yes", "No")
        if answer == 1 then
            info = lastPartialInfo
        end
    end

    if not info then
        Script.ShowMessageBox(L("error"),
            string.format(L("file_info_error"), tostring(infoErr or "incomplete file listing")), "OK")
        return false, 0
    end

    local preserveNames = info.hasSubPaths

    if info.total == 0 or safeLen(info.files) == 0 then
        gCurrentPart = 1
        gTotalParts = 1
        local url
        local dlId = ""
        local isDirectUrl = false
        if info.directDownload then
            local directData, directErr = httpGet(API_BASE .. "/download/" .. tostring(fileId) .. "?fileIndex=0" .. getAuthParam())
            if directData then
                local directUrl = jsonField(directData, "direct_url")
                dlId = jsonField(directData, "download_id") or ""
                if directUrl and directUrl ~= "" then
                    url = directUrl
                    isDirectUrl = true
                end
            end
        end
        if not url then
            url = API_BASE .. "/download/" .. tostring(fileId) .. "?fileIndex=0" .. getAuthParam()
        end
        gCurrentFileId = tostring(fileId)
        gCurrentDownloadId = dlId
        gCurrentGameTitle = fileName
        gCurrentFileName = fileName
        gCurrentTotalSize = fileSize or 0
        if isDirectUrl then
            reportDownload(fileId, "started", 0, 0, fileSize, fileName, fileName, dlId)
        end
        local success, dlErr, elapsed, dlBytes = downloadSingleFile(url, fileName, destRelative, fileSize, preserveNames)
        if isDirectUrl then
            if success then
                reportDownload(fileId, "completed", dlBytes or 0, 0, fileSize, fileName, fileName, dlId)
            elseif dlErr == "cancelled" then
                reportDownload(fileId, "cancelled", 0, 0, fileSize, fileName, fileName, dlId)
            else
                reportDownload(fileId, "failed", 0, 0, fileSize, fileName, fileName, dlId)
            end
        end
        gCurrentFileId = ""
        gCurrentDownloadId = ""
        if dlErr == "cancelled" then
            Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
        end
        if success then
            gDownloadsToday = gDownloadsToday + 1
            if gDownloadsRemaining > 0 then gDownloadsRemaining = gDownloadsRemaining - 1 end
        end
        return success, elapsed, dlBytes
    end

    if info.total == 1 then
        local realName = fileName
        local realSize = fileSize
        if safeLen(info.files) > 0 then
            realName = info.files[1].name
            if info.files[1].size and info.files[1].size > 0 then
                realSize = info.files[1].size
            end
        end
        local url
        local dlId = ""
        local isDirectUrl = false
        if info.directDownload and safeLen(info.files) > 0 and info.files[1].direct_url and info.files[1].direct_url ~= "" then
            url = info.files[1].direct_url
            isDirectUrl = true
            local directData = httpGet(API_BASE .. "/download/" .. tostring(fileId) .. "?fileIndex=0" .. getAuthParam())
            if directData then
                dlId = jsonField(directData, "download_id") or ""
            end
        else
            url = API_BASE .. "/download/" .. tostring(fileId) .. "?fileIndex=0" .. getAuthParam()
        end
        gCurrentPart = 1
        gTotalParts = 1
        gCurrentFileId = tostring(fileId)
        gCurrentDownloadId = dlId
        gCurrentGameTitle = fileName
        gCurrentFileName = realName
        gCurrentTotalSize = realSize or 0
        if isDirectUrl then
            reportDownload(fileId, "started", 0, 0, realSize, realName, fileName, dlId)
        end
        local success, dlErr, elapsed, dlBytes = downloadSingleFile(url, realName, destRelative, realSize, preserveNames)
        if isDirectUrl then
            if success then
                reportDownload(fileId, "completed", dlBytes or 0, 0, realSize, realName, fileName, dlId)
            elseif dlErr == "cancelled" then
                reportDownload(fileId, "cancelled", 0, 0, realSize, realName, fileName, dlId)
            else
                reportDownload(fileId, "failed", 0, 0, realSize, realName, fileName, dlId)
            end
        end
        gCurrentFileId = ""
        gCurrentDownloadId = ""
        if dlErr == "cancelled" then
            Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
        end
        if success then
            gDownloadsToday = gDownloadsToday + 1
            if gDownloadsRemaining > 0 then gDownloadsRemaining = gDownloadsRemaining - 1 end
        end
        return success, elapsed, dlBytes
    end

    local totalFiles = info.total
    local downloaded = 0
    local failed = 0
    local totalBytesDownloaded = 0
    local failedFiles = {}
    local wasCancelled = false
    local grandTotal = 0
    gTotalParts = totalFiles

    gCurrentFileId = tostring(fileId)
    gCurrentGameTitle = fileName
    gCurrentDownloadId = ""

    for i, fileInfo in ipairs(info.files) do
        if gAbortedOperation then
            wasCancelled = true
            break
        end

        gCurrentPart = i
        local subPathParam = ""
        local fileDestRelative = destRelative
        if fileInfo.relative_path and fileInfo.relative_path ~= "" then
            subPathParam = "&subPath=" .. encodeURIComponent(fileInfo.relative_path:gsub("/$", ""))
            local subDir = fileInfo.relative_path:gsub("/", "\\")
            fileDestRelative = destRelative .. subDir
        end
        local url
        if info.directDownload and fileInfo.direct_url and fileInfo.direct_url ~= "" then
            url = fileInfo.direct_url
        else
            url = API_BASE .. "/download/" .. tostring(fileId) .. "?fileIndex=" .. tostring(fileInfo.index) .. subPathParam .. getAuthParam()
        end
        local safeName = truncateFileName(fileInfo.name, 42)
        Script.SetStatus(string.format(L("file_part"), i, totalFiles, safeName))

        local expectedFileSize = (fileInfo.size and fileInfo.size > 0) and fileInfo.size or nil
        gCurrentFileName = fileInfo.name
        gCurrentTotalSize = expectedFileSize or 0
        local success, dlErr, elapsed, dlBytes = downloadSingleFile(url, fileInfo.name, fileDestRelative, expectedFileSize, preserveNames)
        grandTotal = grandTotal + (elapsed or 0)
        if success then
            totalBytesDownloaded = totalBytesDownloaded + (dlBytes or 0)
            downloaded = downloaded + 1
            gDownloadsToday = gDownloadsToday + 1
            if gDownloadsRemaining > 0 then gDownloadsRemaining = gDownloadsRemaining - 1 end
            Script.ShowNotification(i .. "/" .. totalFiles .. " - " .. safeName)
        else
            failed = failed + 1
            table.insert(failedFiles, { index = i, info = fileInfo, name = safeName })
            if dlErr == "cancelled" then
                wasCancelled = true
                break
            end
            Script.ShowNotification(i .. "/" .. totalFiles .. " FALHA: " .. tostring(dlErr))
        end
    end

    gCurrentFileId = ""
    gCurrentDownloadId = ""

    gAbortedOperation = false

    if wasCancelled then
        Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
        return false, grandTotal
    end

    if downloaded > 0 then
        local failStr = ""
        if failed > 0 then failStr = string.format(L("failed_count"), failed) end
        local avgSpeed = 0
        if grandTotal > 0 then avgSpeed = totalBytesDownloaded / grandTotal end
        Script.ShowMessageBox(L("download_complete"),
            string.format(L("download_complete_time_msg"), downloaded, totalFiles, failStr, formatTime(grandTotal), formatSpeed(avgSpeed)), "OK")
    end

    while safeLen(failedFiles) > 0 do
        local failCount = safeLen(failedFiles)
        local retryAnswer = Script.ShowMessageBox(L("download"),
            string.format(L("retry_failed_files"), failCount), "Yes", "No")
        if retryAnswer ~= 1 then
            break
        end

        Script.SetStatus(L("retrying_failed"))
        local retryDownloaded = 0
        local retryFailed = 0
        local newFailedFiles = {}
        local retryTime = 0
        gTotalParts = failCount

        for ri, failedItem in ipairs(failedFiles) do
            if gAbortedOperation then
                wasCancelled = true
                break
            end

            gCurrentPart = ri
            local fileInfo = failedItem.info
            local retrySubPathParam = ""
            local retryDestRelative = destRelative
            if fileInfo.relative_path and fileInfo.relative_path ~= "" then
                retrySubPathParam = "&subPath=" .. encodeURIComponent(fileInfo.relative_path:gsub("/$", ""))
                local subDir = fileInfo.relative_path:gsub("/", "\\")
                retryDestRelative = destRelative .. subDir
            end
            local url
            if info.directDownload and fileInfo.direct_url and fileInfo.direct_url ~= "" then
                url = fileInfo.direct_url
            else
                url = API_BASE .. "/download/" .. tostring(fileId) .. "?fileIndex=" .. tostring(fileInfo.index) .. retrySubPathParam .. getAuthParam()
            end
            local safeName = truncateFileName(fileInfo.name, 42)
            Script.SetStatus(string.format(L("file_part"), ri, failCount, safeName))

            local expectedFileSize = (fileInfo.size and fileInfo.size > 0) and fileInfo.size or nil
            local success, dlErr, elapsed = downloadSingleFile(url, fileInfo.name, retryDestRelative, expectedFileSize, preserveNames)
            retryTime = retryTime + (elapsed or 0)
            if success then
                retryDownloaded = retryDownloaded + 1
                downloaded = downloaded + 1
                failed = failed - 1
                gDownloadsToday = gDownloadsToday + 1
                if gDownloadsRemaining > 0 then gDownloadsRemaining = gDownloadsRemaining - 1 end
                Script.ShowNotification(ri .. "/" .. failCount .. " - " .. safeName)
            else
                retryFailed = retryFailed + 1
                table.insert(newFailedFiles, failedItem)
                if dlErr == "cancelled" then
                    wasCancelled = true
                    break
                end
                Script.ShowNotification(ri .. "/" .. failCount .. " FALHA: " .. tostring(dlErr))
            end
        end

        gAbortedOperation = false
        grandTotal = grandTotal + retryTime

        if wasCancelled then
            Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
            break
        end

        local retryFailStr = ""
        if retryFailed > 0 then retryFailStr = string.format(L("failed_count"), retryFailed) end
        Script.ShowMessageBox(L("download_complete"),
            string.format(L("retry_result"), retryDownloaded, failCount, retryFailStr, formatTime(retryTime)), "OK")

        failedFiles = newFailedFiles
    end

    return downloaded > 0, grandTotal
end

local function getFileTypeLabel(ft)
    if ft == "game" then return L("game_type")
    elseif ft == "dlc" then return L("dlc_type")
    elseif ft == "tu" then return L("update_type")
    elseif ft == "translation" then return L("translation_type")
    else return L("file_type") end
end

local function isInDownloadQueue(fileId)
    for _, item in ipairs(gDownloadQueue) do
        if item.file_id == fileId then return true end
    end
    return false
end

local function addToDownloadQueue(gameName, file)
    if isInDownloadQueue(file.id) then
        Script.ShowNotification(string.format(L("already_in_download_list"), file.label))
        return
    end
    table.insert(gDownloadQueue, {
        file_id = file.id,
        label = file.label,
        file_type = file.file_type,
        file_size = file.file_size,
        folder_path = file.folder_path,
        title_id = file.title_id,
        game_name = gameName
    })
    Script.ShowNotification(string.format(L("added_to_download_list"), file.label))
end

local function removeFromDownloadQueue(fileId)
    for i, item in ipairs(gDownloadQueue) do
        if item.file_id == fileId then
            local label = item.label
            table.remove(gDownloadQueue, i)
            Script.ShowNotification(string.format(L("removed_from_download_list"), label))
            return
        end
    end
end

local function clearDownloadQueue()
    gDownloadQueue = {}
    Script.ShowNotification(L("download_list_cleared"))
end

local function getDownloadQueueCount()
    return #gDownloadQueue
end

-- ShowMessageBox may return 1, true, or other truthy values for the confirm button
-- depending on Aurora version. Accept any non-cancel (2), non-nil, non-false response.
local function showAutoShutdownWarning()
    local choice = Script.ShowMessageBox(L("download_list"), L("auto_shutdown_warning"),
        L("auto_shutdown_continue"), L("auto_shutdown_cancel"))
    return choice ~= nil and choice ~= false and choice ~= 2
end

local function getPlatformLabel(p)
    if p == "xbox360" then return "Xbox 360"
    elseif p == "xbox_original" then return "Xbox Original"
    elseif p == "digital" then return "Digital/XBLA"
    else return p or "Unknown" end
end

local function getAvailableDrives()
    local drives = {}
    local ok, drvList = pcall(FileSystem.GetDrives, false)
    if ok and drvList then
        for _, drv in ipairs(drvList) do
            if drv.MountPoint then
                table.insert(drives, drv.MountPoint)
            end
        end
    end
    if #drives == 0 then
        local fallback = {"Hdd1:", "Usb0:", "Usb1:", "Usb2:"}
        for _, d in ipairs(fallback) do
            local exists = false
            pcall(function() exists = FileSystem.FileExists(d .. "\\") end)
            if exists then table.insert(drives, d) end
        end
    end
    return drives
end

local function checkAlreadyDownloaded(fileName, folderPath, titleId, fileType)
    local destRelative = buildInstallPath(folderPath, titleId, fileType)
    local fullPath = gInstallDrive .. "\\" .. destRelative .. (fileName or "")
    if fileExists(fullPath) then
        local choice = Script.ShowMessageBox(L("already_downloaded"),
            string.format(L("already_downloaded_msg"), fileName or ""), L("yes"), L("no"))
        if choice ~= 1 then
            return false
        end
    end
    return true
end

local function promptRestartAurora()
    local choice = Script.ShowMessageBox(L("restart_aurora"), L("restart_aurora_msg"), L("yes"), L("no"))
    if choice == 1 then
        pcall(Aurora.Restart)
    end
end

local function selectDriveBeforeDownload()
    local drives = getAvailableDrives()
    if #drives == 0 then
        Script.ShowMessageBox(L("error"), L("no_drives"), "OK")
        return false
    end

    Menu.ResetMenu()
    Menu.SetTitle(L("select_drive"))
    Menu.SetExitOnCancel(false)
    Menu.SetGoBackText(L("back"))

    local startItem = Menu.MakeMenuItem(">> " .. L("download") .. " (" .. gInstallDrive .. ")", "start")
    Menu.AddMainMenuItem(startItem)

    for _, d in ipairs(drives) do
        local label = d
        if d == gInstallDrive then label = d .. " *" end
        Menu.AddMainMenuItem(Menu.MakeMenuItem(label, d))
    end

    local driveResult, _, driveCanceled = Menu.ShowMainMenu()
    if driveCanceled or not driveResult then
        return false
    end

    if driveResult == "start" then
        return true
    end

    gInstallDrive = driveResult
    saveSetting("InstallDrive", gInstallDrive)
    return true
end

local function detectVerifyDrive(destRelative)
    local drives = { gInstallDrive, "Hdd1:", "Usb0:", "Usb1:", "Hdd0:" }
    local tried = {}
    for _, drive in ipairs(drives) do
        if not tried[drive] then
            tried[drive] = true
            local basePath = drive .. "\\" .. destRelative
            if basePath:sub(-1) == "\\" then
                basePath = basePath:sub(1, -2)
            end
            local found = false
            pcall(function()
                if FileSystem.FileExists(basePath) then found = true end
            end)
            if not found then
                pcall(function()
                    local items = FileSystem.GetFilesAndDirectories(basePath)
                    if items and type(items) == "table" and #items > 0 then found = true end
                end)
            end
            if not found then
                pcall(function()
                    local withSlash = basePath .. "\\"
                    local items = FileSystem.GetFilesAndDirectories(withSlash)
                    if items and type(items) == "table" and #items > 0 then found = true end
                end)
            end
            if not found then
                local parentPath = basePath:match("^(.+)\\[^\\]+$")
                if parentPath then
                    pcall(function()
                        local items = FileSystem.GetFilesAndDirectories(parentPath)
                        if items and type(items) == "table" then
                            local folderName = basePath:match("([^\\]+)$")
                            for _, item in ipairs(items) do
                                local itemName = tostring(item.Name or item.name or item)
                                if string.upper(itemName) == string.upper(folderName or "") then
                                    found = true
                                    break
                                end
                            end
                        end
                    end)
                end
            end
            if found then return drive end
        end
    end
    return gInstallDrive
end

local function verifyInstallation(game, singleFile)
    local filesToCheck = {}
    if singleFile then
        table.insert(filesToCheck, singleFile)
    else
        if game.files then
            for _, f in ipairs(game.files) do
                table.insert(filesToCheck, f)
            end
        end
    end

    local fileCount = safeLen(filesToCheck)
    if fileCount == 0 then
        Script.ShowMessageBox(L("verify_title"), L("verify_no_files"), "OK")
        return
    end

    Script.SetStatus(L("verifying_files"))

    local okFiles = {}
    local missingFiles = {}
    local wrongSizeFiles = {}
    local problemGameFiles = {}
    local problemSubFiles = {}

    local gameTitleId = game.title_id or ""

    for _, file in ipairs(filesToCheck) do
        local fileTid = file.title_id or ""
        if fileTid == "" then fileTid = gameTitleId end
        local destRelative = buildInstallPath(file.folder_path, fileTid, file.file_type)

        local verifyDrive = detectVerifyDrive(destRelative)

        Script.SetStatus(string.format(L("verify_checking"), truncateFileName(file.label, 30)))

        local info, infoErr
        for infoAttempt = 1, 3 do
            info, infoErr = fetchFileInfo(file.id)
            if info then break end
        end

        if not info or safeLen(info.files) == 0 then
            if info and info.total == 0 then
                local safeName = string.gsub(file.label or "download", '[<>:"/|%?%*%[%]]', "_")
                safeName = shortFinalName(safeName, 12)
                local filePath = verifyDrive .. "\\" .. destRelative .. safeName
                if fileExists(filePath) then
                    local actualSize = getFileSize(filePath)
                    if file.file_size and file.file_size > 0 and actualSize > 0 and actualSize < file.file_size then
                        table.insert(wrongSizeFiles, { name = file.label, expected = file.file_size, actual = actualSize })
                        table.insert(problemGameFiles, file)
                        table.insert(problemSubFiles, {
                            fileId = file.id,
                            gameFileId = file.id,
                            index = 0,
                            name = file.label,
                            size = file.file_size,
                            relative_path = "",
                            destRelative = destRelative,
                            preserveNames = false
                        })
                    else
                        table.insert(okFiles, { name = file.label })
                    end
                else
                    table.insert(missingFiles, { name = file.label })
                    table.insert(problemGameFiles, file)
                    table.insert(problemSubFiles, {
                        fileId = file.id,
                        gameFileId = file.id,
                        index = 0,
                        name = file.label,
                        size = file.file_size,
                        relative_path = "",
                        destRelative = destRelative,
                        preserveNames = false
                    })
                end
            else
                table.insert(missingFiles, { name = file.label })
                table.insert(problemGameFiles, file)
                table.insert(problemSubFiles, {
                    fileId = file.id,
                    gameFileId = file.id,
                    index = 0,
                    name = file.label,
                    size = file.file_size,
                    relative_path = "",
                    destRelative = destRelative,
                    preserveNames = false
                })
            end
        else
            local fileHasProblems = false
            for _, subFile in ipairs(info.files) do
                local subDir = ""
                if subFile.relative_path and subFile.relative_path ~= "" then
                    subDir = subFile.relative_path:gsub("/", "\\")
                end
                local fileDestRelative = destRelative .. subDir

                local safeName = subFile.name
                if not info.hasSubPaths then
                    safeName = shortFinalName(string.gsub(safeName or "download", '[<>:"/|%?%*%[%]]', "_"), 12)
                else
                    safeName = string.gsub(safeName or "download", '[<>:"/|%?%*%[%]]', "_")
                end

                local filePath = verifyDrive .. "\\" .. fileDestRelative .. safeName
                if fileExists(filePath) then
                    local actualSize = getFileSize(filePath)
                    if subFile.size and subFile.size > 0 and actualSize > 0 and actualSize < subFile.size then
                        table.insert(wrongSizeFiles, { name = subFile.name, expected = subFile.size, actual = actualSize })
                        fileHasProblems = true
                        table.insert(problemSubFiles, {
                            fileId = file.id,
                            gameFileId = file.id,
                            index = subFile.index,
                            name = subFile.name,
                            size = subFile.size,
                            relative_path = subFile.relative_path or "",
                            destRelative = destRelative,
                            preserveNames = info.hasSubPaths
                        })
                    else
                        table.insert(okFiles, { name = subFile.name })
                    end
                else
                    table.insert(missingFiles, { name = subFile.name })
                    fileHasProblems = true
                    table.insert(problemSubFiles, {
                        fileId = file.id,
                        gameFileId = file.id,
                        index = subFile.index,
                        name = subFile.name,
                        size = subFile.size,
                        relative_path = subFile.relative_path or "",
                        destRelative = destRelative,
                        preserveNames = info.hasSubPaths
                    })
                end
            end
            if fileHasProblems then
                table.insert(problemGameFiles, file)
            end
        end
    end

    Script.SetStatus("")

    local okCount = safeLen(okFiles)
    local missingCount = safeLen(missingFiles)
    local wrongCount = safeLen(wrongSizeFiles)

    local resultMsg = string.format(L("verify_summary"), okCount, missingCount, wrongCount)

    if missingCount == 0 and wrongCount == 0 then
        resultMsg = L("verify_all_ok") .. "\n\n" .. resultMsg
    else
        local details = ""
        for i, f in ipairs(missingFiles) do
            if i <= 10 then
                details = details .. "\n[" .. L("verify_missing") .. "] " .. truncateFileName(f.name, 35)
            end
        end
        for i, f in ipairs(wrongSizeFiles) do
            if i <= 10 then
                details = details .. "\n[" .. L("verify_wrong_size") .. "] " .. truncateFileName(f.name, 35)
            end
        end
        if (missingCount + wrongCount) > 10 then
            details = details .. "\n..."
        end
        resultMsg = resultMsg .. "\n" .. details
    end

    if missingCount > 0 or wrongCount > 0 then
        local firstFile = filesToCheck[1]
        if firstFile then
            local fTid = firstFile.title_id or ""
            if fTid == "" then fTid = gameTitleId end
            local dr = buildInstallPath(firstFile.folder_path, fTid, firstFile.file_type)
            local dd = detectVerifyDrive(dr)
            resultMsg = resultMsg .. "\n\n[" .. dd .. "\\" .. dr .. "]"
        end
    end

    Script.ShowMessageBox(L("verify_title"), resultMsg, "OK")

    local subFileCount = safeLen(problemSubFiles)
    if subFileCount > 0 then
        Menu.ResetMenu()
        Menu.SetTitle(L("verify_title"))
        Menu.SetExitOnCancel(false)
        Menu.SetGoBackText(L("back"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem(string.format(L("verify_redownload"), subFileCount), "label"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem(L("yes"), "yes"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem(L("no"), "no"))
        local redownloadResult, _, redownloadCanceled = Menu.ShowMainMenu()
        if not redownloadCanceled and redownloadResult == "yes" then
            if selectDriveBeforeDownload() then
                local downloaded = 0
                local failed = 0
                local allTime = 0
                local totalBytes = 0
                gTotalParts = subFileCount

                local trackedGameIds = {}
                gCurrentDownloadId = ""

                for i, sf in ipairs(problemSubFiles) do
                    gCurrentPart = i
                    gCurrentFileId = tostring(sf.fileId)
                    gCurrentGameTitle = sf.name

                    if gAbortedOperation then
                        gAbortedOperation = false
                        Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
                        break
                    end

                    local subPathParam = ""
                    local fileDestRelative = sf.destRelative
                    if sf.relative_path and sf.relative_path ~= "" then
                        subPathParam = "&subPath=" .. encodeURIComponent(sf.relative_path:gsub("/$", ""))
                        local subDir = sf.relative_path:gsub("/", "\\")
                        fileDestRelative = sf.destRelative .. subDir
                    end

                    local url
                    if sf.direct_url and sf.direct_url ~= "" then
                        url = sf.direct_url
                    else
                        url = API_BASE .. "/download/" .. tostring(sf.fileId) .. "?fileIndex=" .. tostring(sf.index) .. subPathParam .. getAuthParam()
                    end
                    local safeName = truncateFileName(sf.name, 42)
                    Script.SetStatus(string.format(L("file_part"), i, subFileCount, safeName))

                    local expectedFileSize = (sf.size and sf.size > 0) and sf.size or nil
                    gCurrentFileName = sf.name
                    gCurrentTotalSize = expectedFileSize or 0
                    local success, dlErr, elapsed = downloadSingleFile(url, sf.name, fileDestRelative, expectedFileSize, sf.preserveNames)
                    allTime = allTime + (elapsed or 0)

                    if success then
                        downloaded = downloaded + 1
                        if expectedFileSize then totalBytes = totalBytes + expectedFileSize end
                        if sf.gameFileId and not trackedGameIds[sf.gameFileId] then
                            trackedGameIds[sf.gameFileId] = true
                            gDownloadedFileIds[sf.gameFileId] = true
                        end
                        Script.ShowNotification(i .. "/" .. subFileCount .. " - " .. safeName)
                    else
                        failed = failed + 1
                        if dlErr == "cancelled" then
                            gAbortedOperation = false
                            Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
                            break
                        end
                        Script.ShowNotification(i .. "/" .. subFileCount .. " FALHA: " .. tostring(dlErr))
                    end
                end

                gAbortedOperation = false
                gCurrentFileId = ""
                gCurrentDownloadId = ""

                if downloaded > 0 or failed > 0 then
                    local failStr = ""
                    if failed > 0 then failStr = string.format(L("failed_count"), failed) end
                    if totalBytes > 0 then
                        local totalMB = totalBytes / 1048576
                        local sizeDisplay
                        if totalMB >= 980 then
                            sizeDisplay = string.format("%.2f GB", totalMB / 1000)
                        else
                            sizeDisplay = string.format("%.2f MB", totalMB)
                        end
                        failStr = failStr .. L("verify_total_downloaded") .. ": " .. sizeDisplay .. "\n"
                    end
                    Script.ShowMessageBox(L("complete"),
                        string.format(L("download_complete_time_msg"), downloaded, subFileCount, failStr, formatTime(allTime)), "OK")
                end
            end
        end
    end
end

local function isGameInstalled(titleId)
    if not titleId or titleId == "" then return false end
    local tidUpper = string.upper(titleId)
    local installed = false
    local drives = { gInstallDrive, "Hdd1:", "Usb0:", "Usb1:" }
    local tried = {}
    for _, drive in ipairs(drives) do
        if installed then break end
        if not tried[drive] then
            tried[drive] = true
            pcall(function()
                local contentPath = drive .. "\\Content\\0000000000000000\\" .. tidUpper
                if FileSystem.FileExists(contentPath) then
                    installed = true
                end
            end)
            if not installed then
                pcall(function()
                    local contentPath = drive .. "\\Content\\0000000000000000\\" .. tidUpper
                    local items = FileSystem.GetFilesAndDirectories(contentPath)
                    if items and type(items) == "table" and #items > 0 then
                        installed = true
                    end
                end)
            end
        end
    end
    if not installed then
        pcall(function()
            local scanned = scanInstalledGames()
            for _, ig in ipairs(scanned) do
                if ig.titleId and string.upper(ig.titleId) == tidUpper then
                    installed = true
                    break
                end
            end
        end)
    end
    return installed
end

local function showDownloadList()
    while true do
        if getDownloadQueueCount() == 0 then
            Script.ShowMessageBox(L("download_list"), L("download_list_empty"), "OK")
            return
        end

        Menu.ResetMenu()
        Menu.SetTitle(L("download_list") .. " (" .. string.format(L("download_list_count"), getDownloadQueueCount()) .. ")")
        Menu.SetExitOnCancel(false)
        Menu.SetGoBackText(L("back"))

        for idx, item in ipairs(gDownloadQueue) do
            local typeLabel = getFileTypeLabel(item.file_type)
            local sizeLabel = ""
            if item.file_size and item.file_size > 0 then
                sizeLabel = "-" .. formatSize(item.file_size)
            end
            local typeClean = typeLabel:gsub("^%[", ""):gsub("%]$", "")
            local label = string.format("%02d", idx) .. " - " .. item.game_name .. " [" .. typeClean .. sizeLabel .. "]"
            Menu.AddMainMenuItem(Menu.MakeMenuItem(label, { action = "queue_item", index = idx }))
        end

        Menu.AddMainMenuItem(Menu.MakeMenuItem(L("files_separator"), "separator"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem(">> " .. L("download_all_list"), "download_all_queue"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem(">> " .. L("clear_download_list"), "clear_queue"))

        local result, _, canceled = Menu.ShowMainMenu()
        if canceled or not result then
            return
        end

        if result == "download_all_queue" then
            local canProceed = true
            if gGuestMode then
                if not checkGuestCanDownload() then
                    gDownloadsRemaining = 0
                    canProceed = false
                end
            end
            if canProceed and showAutoShutdownWarning() then
                if selectDriveBeforeDownload() then
                    local downloaded = 0
                    local failed = 0
                    local allTime = 0
                    local allBytes = 0
                    local wasCancelled = false
                    local totalItems = getDownloadQueueCount()
                    gTotalParts = totalItems

                    local i = 1
                    while i <= #gDownloadQueue do
                        local item = gDownloadQueue[i]
                        gCurrentPart = downloaded + failed + 1
                        if gGuestMode and not checkGuestCanDownload() then
                            gDownloadsRemaining = 0
                            break
                        end
                        local success, elapsed, dlBytes = downloadFile(item.file_id, item.label, item.folder_path, item.title_id, item.file_type, item.file_size)
                        allTime = allTime + (elapsed or 0)
                        if success then
                            allBytes = allBytes + (dlBytes or 0)
                            downloaded = downloaded + 1
                            if item.file_id then gDownloadedFileIds[item.file_id] = true end
                            if gGuestMode then trackGuestDownload() end
                            table.remove(gDownloadQueue, i)
                        else
                            failed = failed + 1
                            i = i + 1
                        end
                        if gAbortedOperation then
                            wasCancelled = true
                            break
                        end
                    end

                    gAbortedOperation = false

                    if wasCancelled then
                        Script.ShowMessageBox(L("download_aborted"),
                            string.format(L("batch_download_cancelled"), downloaded, totalItems), "OK")
                    else
                        local avgSpeed = 0
                        if allTime > 0 then avgSpeed = allBytes / allTime end
                        Script.ShowMessageBox(L("download_list"),
                            string.format(L("batch_download_complete"), downloaded, totalItems, formatTime(allTime), formatSpeed(avgSpeed)), "OK")
                        if downloaded > 0 then
                            promptRestartAurora()
                        end
                    end
                end
            end
        elseif result == "clear_queue" then
            clearDownloadQueue()
        elseif type(result) == "table" and result.action == "queue_item" then
            local idx = result.index
            local item = gDownloadQueue[idx]
            if item then
                local itemTid = item.title_id or ""
                local itemIsInstalled = isGameInstalled(itemTid)

                Menu.ResetMenu()
                Menu.SetTitle(item.game_name .. " - " .. item.label)
                Menu.SetExitOnCancel(false)
                Menu.SetGoBackText(L("back"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("download_game"), "do_download_single"))
                if itemIsInstalled then
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("verify_installation"), "do_verify_single"))
                end
                Menu.AddMainMenuItem(Menu.MakeMenuItem("3. " .. L("report_item"), "do_report_single"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem("4. " .. L("remove_from_download_list"), "do_remove"))

                local subResult, _, subCanceled = Menu.ShowMainMenu()
                if not subCanceled and subResult == "do_remove" then
                    removeFromDownloadQueue(item.file_id)
                elseif not subCanceled and subResult == "do_download_single" then
                    if showAutoShutdownWarning() then
                      if gGuestMode then
                        if not checkGuestCanDownload() then
                            gDownloadsRemaining = 0
                        else
                            if selectDriveBeforeDownload() then
                                if checkAlreadyDownloaded(item.label, item.folder_path, item.title_id, item.file_type) then
                                    local success, elapsed, dlBytes = downloadFile(item.file_id, item.label, item.folder_path, item.title_id, item.file_type, item.file_size)
                                    if success then
                                        if item.file_id then gDownloadedFileIds[item.file_id] = true end
                                        trackGuestDownload()
                                        removeFromDownloadQueue(item.file_id)
                                        local timeStr = formatTime(elapsed or 0)
                                        local avgSpeed = 0
                                        if (elapsed or 0) > 0 then avgSpeed = (dlBytes or 0) / elapsed end
                                        Script.ShowNotification(string.format(L("downloaded_notification"), item.label))
                                        Script.ShowMessageBox(L("success"),
                                            string.format(L("success_time_msg"), item.label, timeStr, formatSpeed(avgSpeed)), "OK")
                                        promptRestartAurora()
                                    end
                                end
                            end
                        end
                      else
                        if selectDriveBeforeDownload() then
                            if checkAlreadyDownloaded(item.label, item.folder_path, item.title_id, item.file_type) then
                                local success, elapsed, dlBytes = downloadFile(item.file_id, item.label, item.folder_path, item.title_id, item.file_type, item.file_size)
                                if success then
                                    if item.file_id then gDownloadedFileIds[item.file_id] = true end
                                    removeFromDownloadQueue(item.file_id)
                                    local timeStr = formatTime(elapsed or 0)
                                    local avgSpeed = 0
                                    if (elapsed or 0) > 0 then avgSpeed = (dlBytes or 0) / elapsed end
                                    Script.ShowNotification(string.format(L("downloaded_notification"), item.label))
                                    Script.ShowMessageBox(L("success"),
                                        string.format(L("success_time_msg"), item.label, timeStr, formatSpeed(avgSpeed)), "OK")
                                    promptRestartAurora()
                                end
                            end
                        end
                      end
                    end
                elseif not subCanceled and subResult == "do_report_single" then
                    Menu.ResetMenu()
                    Menu.SetTitle(L("report_title"))
                    Menu.SetExitOnCancel(false)
                    Menu.SetGoBackText(L("back"))
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("report_wrong"), "wrong"))
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("report_corrupted"), "corrupted"))
                    local reportResult, _, reportCanceled = Menu.ShowMainMenu()
                    if not reportCanceled and reportResult then
                        pcall(function()
                            local reportParams = "file_id=" .. tostring(item.file_id) .. "&type=" .. reportResult
                            if gLoggedIn and not gGuestMode and gUserId > 0 then
                                reportParams = reportParams .. "&user_id=" .. tostring(gUserId)
                            end
                            if gConsoleId ~= "" then
                                reportParams = reportParams .. "&console_id=" .. safeUrlEncode(gConsoleId)
                            end
                            local reportUrl = API_BASE .. "/report?" .. reportParams
                            local data = httpGet(reportUrl)
                            if data and jsonFieldBool(data, "success") then
                                Script.ShowNotification(L("report_success"))
                            else
                                Script.ShowNotification(L("report_error"))
                            end
                        end)
                    end
                elseif not subCanceled and subResult == "do_verify_single" then
                    local queueFile = {
                        id = item.file_id,
                        label = item.label,
                        file_type = item.file_type,
                        file_size = item.file_size,
                        folder_path = item.folder_path,
                        title_id = item.title_id
                    }
                    local queueGame = { title_id = item.title_id or "" }
                    verifyInstallation(queueGame, queueFile)
                end
            end
        end
    end
end

local function showGameDetails(gameId)
    local ok, err = pcall(function()
        local game = fetchGameDetails(gameId)
        if not game then return end

        while true do
            Menu.ResetMenu()
            local displayTitle = game.title or "Game Details"
            if game.platform then
                local platLabel = getPlatformLabel(game.platform)
                if platLabel ~= "" then
                    displayTitle = displayTitle .. " | " .. platLabel
                end
            end
            if game.files then
                for _, f in ipairs(game.files) do
                    if f.id and gDownloadedFileIds[f.id] then
                        displayTitle = displayTitle .. " (\226\134\147)"
                        break
                    end
                end
            end
            Menu.SetTitle(displayTitle)
            Menu.SetExitOnCancel(false)
            Menu.SetGoBackText(L("back"))

            local infoParts = {}
            if game.publisher and game.publisher ~= "" then
                table.insert(infoParts, L("publisher_label") .. ": " .. game.publisher)
            end
            local gameTitleId = game.title_id or ""
            if gameTitleId ~= "" then
                table.insert(infoParts, "Title ID: " .. gameTitleId)
            end
            if safeLen(infoParts) > 0 then
                Menu.AddMainMenuItem(Menu.MakeMenuItem("- " .. table.concat(infoParts, " | "), "info_line_2"))
            end

            local ratingLabel = ""
            if game.avg_rating and game.avg_rating > 0 and game.total_votes and game.total_votes > 0 then
                ratingLabel = string.format(L("rate_current"), tostring(game.avg_rating), game.total_votes)
            else
                ratingLabel = L("no_rating")
            end
            Menu.AddMainMenuItem(Menu.MakeMenuItem("- [" .. L("rate_game") .. "] " .. ratingLabel, "rate_game"))

            if gLoggedIn and not gGuestMode and gUserId > 0 then
                local isFav = false
                pcall(function()
                    local favUrl = API_BASE .. "/favorites/check?game_id=" .. tostring(gameId) .. "&user_id=" .. tostring(gUserId)
                    local favData = httpGet(favUrl)
                    if favData then
                        isFav = jsonFieldBool(favData, "is_favorite")
                    end
                end)
                local favLabel = isFav and L("remove_favorite") or L("add_favorite")
                local favAction = isFav and "remove_favorite" or "add_favorite"
                Menu.AddMainMenuItem(Menu.MakeMenuItem("- [" .. favLabel .. "]", favAction))
            end

            if game.description and game.description ~= "" then
                Menu.AddMainMenuItem(Menu.MakeMenuItem("- [" .. L("view_description") .. "]", "show_description"))
            end

            local fileCount = safeLen(game.files)

            if fileCount > 0 then
                local sepItem = Menu.MakeMenuItem(L("files_separator"), "files_separator")
                Menu.AddMainMenuItem(sepItem)

                local fileNum = 1
                for _, file in ipairs(game.files) do
                    local label = string.format("%02d", fileNum) .. " - " .. getFileTypeLabel(file.file_type) .. " " .. file.label
                    if file.file_size and file.file_size > 0 then
                        label = label .. " [" .. formatSize(file.file_size) .. "]"
                    end
                    if file.id and gDownloadedFileIds[file.id] then
                        label = label .. " " .. L("downloaded_badge")
                    end
                    local fileItem = Menu.MakeMenuItem(label, { action = "download", file = file })
                    Menu.AddMainMenuItem(fileItem)
                    fileNum = fileNum + 1
                end

                if fileCount > 1 then
                    local allItem = Menu.MakeMenuItem(string.format("%02d", fileNum) .. " - " .. L("download_all_btn"), { action = "download_all" })
                    Menu.AddMainMenuItem(allItem)
                end
            else
                local noFiles = Menu.MakeMenuItem(L("no_files_available"), "label")
                Menu.AddMainMenuItem(noFiles)
            end

            local result, parentMenu, canceled = Menu.ShowMainMenu()

            if canceled or not result then
                return
            end

            if type(result) == "table" and result.action == "download" then
                local file = result.file
                local gameTid = game.title_id or ""
                local isInstalled = isGameInstalled(gameTid)

                Menu.ResetMenu()
                Menu.SetTitle(L("download_or_verify"))
                Menu.SetExitOnCancel(false)
                Menu.SetGoBackText(L("back"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("download_game"), "do_download"))
                if isInstalled then
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("verify_installation"), "do_verify"))
                end
                Menu.AddMainMenuItem(Menu.MakeMenuItem("3. " .. L("report_item"), "do_report"))
                if isInDownloadQueue(file.id) then
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("4. " .. L("remove_from_download_list"), "do_unqueue"))
                else
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("4. " .. L("add_to_download_list"), "do_queue"))
                end

                local subResult, _, subCanceled = Menu.ShowMainMenu()
                if not subCanceled and subResult == "do_report" then
                    Menu.ResetMenu()
                    Menu.SetTitle(L("report_title"))
                    Menu.SetExitOnCancel(false)
                    Menu.SetGoBackText(L("back"))
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("report_wrong"), "wrong"))
                    Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("report_corrupted"), "corrupted"))
                    local reportResult, _, reportCanceled = Menu.ShowMainMenu()
                    if not reportCanceled and reportResult then
                        pcall(function()
                            local reportParams = "file_id=" .. tostring(file.id) .. "&type=" .. reportResult
                            if gLoggedIn and not gGuestMode and gUserId > 0 then
                                reportParams = reportParams .. "&user_id=" .. tostring(gUserId)
                            end
                            if gConsoleId ~= "" then
                                reportParams = reportParams .. "&console_id=" .. safeUrlEncode(gConsoleId)
                            end
                            local reportUrl = API_BASE .. "/report?" .. reportParams
                            local data = httpGet(reportUrl)
                            if data and jsonFieldBool(data, "success") then
                                Script.ShowNotification(L("report_success"))
                            else
                                Script.ShowNotification(L("report_error"))
                            end
                        end)
                    end
                elseif not subCanceled and subResult == "do_download" then
                    if gGuestMode then
                        if not checkGuestCanDownload() then
                            gDownloadsRemaining = 0
                        else
                            if selectDriveBeforeDownload() then
                                if checkAlreadyDownloaded(file.label, file.folder_path, file.title_id, file.file_type) then
                                    local success, elapsed, dlBytes = downloadFile(file.id, file.label, file.folder_path, file.title_id, file.file_type, file.file_size)
                                    if success then
                                        if file.id then gDownloadedFileIds[file.id] = true end
                                        trackGuestDownload()
                                        gDownloadsRemaining = 0
                                        gDownloadsToday = 1
                                        local timeStr = formatTime(elapsed or 0)
                                        local avgSpeed = 0
                                        if (elapsed or 0) > 0 then avgSpeed = (dlBytes or 0) / elapsed end
                                        Script.ShowNotification(string.format(L("downloaded_notification"), file.label))
                                        Script.ShowMessageBox(L("success"),
                                            string.format(L("success_time_msg"), file.label, timeStr, formatSpeed(avgSpeed)), "OK")
                                        promptRestartAurora()
                                    end
                                end
                            end
                        end
                    else
                        if selectDriveBeforeDownload() then
                            if checkAlreadyDownloaded(file.label, file.folder_path, file.title_id, file.file_type) then
                                local success, elapsed, dlBytes = downloadFile(file.id, file.label, file.folder_path, file.title_id, file.file_type, file.file_size)
                                if success then
                                    if file.id then gDownloadedFileIds[file.id] = true end
                                    local timeStr = formatTime(elapsed or 0)
                                    local avgSpeed = 0
                                    if (elapsed or 0) > 0 then avgSpeed = (dlBytes or 0) / elapsed end
                                    Script.ShowNotification(string.format(L("downloaded_notification"), file.label))
                                    Script.ShowMessageBox(L("success"),
                                        string.format(L("success_time_msg"), file.label, timeStr, formatSpeed(avgSpeed)), "OK")
                                    promptRestartAurora()
                                end
                            end
                        end
                    end
                elseif not subCanceled and subResult == "do_verify" then
                    verifyInstallation(game, file)
                elseif not subCanceled and subResult == "do_queue" then
                    addToDownloadQueue(game.title or "Unknown", file)
                elseif not subCanceled and subResult == "do_unqueue" then
                    removeFromDownloadQueue(file.id)
                end

            elseif type(result) == "table" and result.action == "download_all" then
              if showAutoShutdownWarning() then
                if selectDriveBeforeDownload() then
                    local downloaded = 0
                    local failed = 0
                    local failedGameFiles = {}
                    local allTime = 0
                    local allBytes = 0
                    local wasCancelled = false
                    gTotalParts = fileCount

                    for i, file in ipairs(game.files) do
                        gCurrentPart = i
                        local success, elapsed, dlBytes = downloadFile(file.id, file.label, file.folder_path, file.title_id, file.file_type, file.file_size)
                        allTime = allTime + (elapsed or 0)
                        if success then
                            allBytes = allBytes + (dlBytes or 0)
                            downloaded = downloaded + 1
                            if file.id then gDownloadedFileIds[file.id] = true end
                        else
                            failed = failed + 1
                            table.insert(failedGameFiles, file)
                        end
                        if gAbortedOperation then
                            wasCancelled = true
                            break
                        end
                    end

                    gAbortedOperation = false

                    if not wasCancelled then
                        local failStr = ""
                        if failed > 0 then failStr = string.format(L("failed_count"), failed) end
                        local avgSpeed = 0
                        if allTime > 0 then avgSpeed = allBytes / allTime end
                        Script.ShowMessageBox(L("complete"),
                            string.format(L("download_complete_time_msg"), downloaded, fileCount, failStr, formatTime(allTime), formatSpeed(avgSpeed)), "OK")

                        while safeLen(failedGameFiles) > 0 do
                            local failCount = safeLen(failedGameFiles)
                            local retryAnswer = Script.ShowMessageBox(L("download"),
                                string.format(L("retry_failed_files"), failCount), "Yes", "No")
                            if retryAnswer ~= 1 then
                                break
                            end

                            local retryDownloaded = 0
                            local retryFailed = 0
                            local newFailedGameFiles = {}
                            local retryTime = 0
                            gTotalParts = failCount

                            for ri, file in ipairs(failedGameFiles) do
                                gCurrentPart = ri
                                local success, elapsed = downloadFile(file.id, file.label, file.folder_path, file.title_id, file.file_type, file.file_size)
                                retryTime = retryTime + (elapsed or 0)
                                if success then
                                    retryDownloaded = retryDownloaded + 1
                                    downloaded = downloaded + 1
                                    failed = failed - 1
                                    if file.id then gDownloadedFileIds[file.id] = true end
                                else
                                    retryFailed = retryFailed + 1
                                    table.insert(newFailedGameFiles, file)
                                end
                                if gAbortedOperation then
                                    wasCancelled = true
                                    break
                                end
                            end

                            gAbortedOperation = false
                            allTime = allTime + retryTime

                            if wasCancelled then
                                Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
                                break
                            end

                            local retryFailStr = ""
                            if retryFailed > 0 then retryFailStr = string.format(L("failed_count"), retryFailed) end
                            Script.ShowMessageBox(L("download_complete"),
                                string.format(L("retry_result"), retryDownloaded, failCount, retryFailStr, formatTime(retryTime)), "OK")

                            failedGameFiles = newFailedGameFiles
                        end

                        if downloaded > 0 then
                            promptRestartAurora()
                        end
                    else
                        Script.ShowMessageBox(L("download_aborted"), L("download_aborted"), "OK")
                    end
                end
              end

            elseif result == "show_description" then
                if game.description and game.description ~= "" then
                    Script.ShowMessageBox(game.title or "Description", game.description, "OK")
                end

            elseif result == "rate_game" then
                Menu.ResetMenu()
                Menu.SetTitle(L("how_many_stars"))
                Menu.SetExitOnCancel(false)
                Menu.SetGoBackText(L("back"))
                for stars = 1, 5 do
                    local starStr = string.rep("*", stars)
                    Menu.AddMainMenuItem(Menu.MakeMenuItem(tostring(stars) .. " " .. starStr, tostring(stars)))
                end
                local rateResult, _, rateCanceled = Menu.ShowMainMenu()
                if not rateCanceled and rateResult then
                    local rateVal = tonumber(rateResult)
                    if rateVal and rateVal >= 1 and rateVal <= 5 then
                        pcall(function()
                            local userParam = ""
                            if gLoggedIn and not gGuestMode and gUserId > 0 then
                                userParam = "&user_id=" .. tostring(gUserId)
                            elseif gConsoleId ~= "" then
                                userParam = "&console_id=" .. safeUrlEncode(gConsoleId)
                            end
                            local rateUrl = API_BASE .. "/games/" .. tostring(gameId) .. "/rate?rating=" .. tostring(rateVal) .. userParam
                            local data = httpGet(rateUrl)
                            if data then
                                local newAvg = jsonField(data, "avg_rating") or "0"
                                local newVotes = jsonFieldNumber(data, "total_votes") or 0
                                game.avg_rating = tonumber(newAvg) or 0
                                game.total_votes = newVotes
                                Script.ShowNotification(L("rate_success"))
                            end
                        end)
                    end
                end

            elseif result == "add_favorite" then
                pcall(function()
                    local url = API_BASE .. "/favorites/add?game_id=" .. tostring(gameId) .. "&user_id=" .. tostring(gUserId)
                    httpGet(url)
                    Script.ShowNotification(L("favorite_added"))
                end)

            elseif result == "remove_favorite" then
                pcall(function()
                    local url = API_BASE .. "/favorites/remove?game_id=" .. tostring(gameId) .. "&user_id=" .. tostring(gUserId)
                    httpGet(url)
                    Script.ShowNotification(L("favorite_removed"))
                end)

            elseif result == "label" or result == "info_line_1" or result == "info_line_2" or result == "files_separator" then
            end
        end
    end)
    if not ok then
        Script.ShowMessageBox(L("error"), string.format(L("error_details"), tostring(err)), "OK")
    end
end

local function showSearchMenu()
    local ok, keyboard = pcall(Script.ShowKeyboard, L("search"), L("search_prompt"), "", 0)
    if not ok or type(keyboard) ~= "table" then
        Script.ShowMessageBox(L("error"), string.format(L("keyboard_error"), tostring(keyboard)), "OK")
        return nil
    end
    if keyboard.Canceled then return nil end
    local term = keyboard.Buffer
    if not term or term == "" then return nil end
    return term
end

local function showGameListDirect(games, gameCount, titleStr)
    while true do
        Menu.ResetMenu()
        Menu.SetTitle(titleStr)
        Menu.SetExitOnCancel(false)
        Menu.SetGoBackText(L("back"))
        Menu.SetSortAlphaBetically(true)

        local installedCache = {}
        for _, game in ipairs(games) do
            if game.title_id and game.title_id ~= "" then
                local tid = string.upper(game.title_id)
                if installedCache[tid] == nil then
                    local found = false
                    local drivesToCheck = { gInstallDrive }
                    if gInstallDrive ~= "Hdd1:" then table.insert(drivesToCheck, "Hdd1:") end
                    for _, drv in ipairs(drivesToCheck) do
                        if found then break end
                        local contentPath = drv .. "\\Content\\0000000000000000\\" .. tid
                        pcall(function()
                            if FileSystem.FileExists(contentPath) then found = true end
                        end)
                        if not found then
                            pcall(function()
                                local items = FileSystem.GetFilesAndDirectories(contentPath)
                                if items and type(items) == "table" and #items > 0 then found = true end
                            end)
                        end
                    end
                    installedCache[tid] = found
                end
            end
        end

        for _, game in ipairs(games) do
            local title = game.title
            if game.title_id and game.title_id ~= "" then
                local tid = string.upper(game.title_id)
                if installedCache[tid] then
                    title = title .. L("installed_badge")
                end
            end
            local item = Menu.MakeMenuItem(title, game.id)
            Menu.AddMainMenuItem(item)
        end

        local result, parentMenu, canceled = Menu.ShowMainMenu()

        if canceled or not result then
            return
        end

        if type(result) == "number" then
            showGameDetails(result)
        end
    end
end

local function showGameListAlpha(games, gameCount, titleStr)
    local buckets = {}
    local bucketKeys = {}

    for _, game in ipairs(games) do
        local firstChar = string.upper(string.sub(game.title, 1, 1))
        if string.match(firstChar, "%d") then firstChar = "#" end
        if not string.match(firstChar, "%a") and firstChar ~= "#" then firstChar = "#" end

        if not buckets[firstChar] then
            buckets[firstChar] = {}
            table.insert(bucketKeys, firstChar)
        end
        table.insert(buckets[firstChar], game)
    end

    table.sort(bucketKeys, function(a, b)
        if a == "#" then return true end
        if b == "#" then return false end
        return a < b
    end)

    while true do
        Menu.ResetMenu()
        Menu.SetTitle(titleStr)
        Menu.SetExitOnCancel(false)
        Menu.SetGoBackText(L("back"))

        for _, key in ipairs(bucketKeys) do
            local count = safeLen(buckets[key])
            local label = key .. "  (" .. count .. ")"
            Menu.AddMainMenuItem(Menu.MakeMenuItem(label, key))
        end

        local result, _, canceled = Menu.ShowMainMenu()
        if canceled or not result then return end

        local selectedGames = buckets[result]
        if selectedGames then
            local subTitle = titleStr .. " > " .. result
            showGameListDirect(selectedGames, safeLen(selectedGames), subTitle)
        end
    end
end

local function selectScanDrive()
    local drives = {"Hdd1:", "Usb0:", "Usb1:", "Usb2:", "Usb3:", "Usb4:"}
    Menu.ResetMenu()
    Menu.SetTitle(L("select_scan_drive"))
    Menu.SetExitOnCancel(false)
    Menu.SetGoBackText(L("back"))

    for _, d in ipairs(drives) do
        local label = d
        if d == gMyGamesDrive then label = d .. " *" end
        Menu.AddMainMenuItem(Menu.MakeMenuItem(label, d))
    end

    local driveResult, _, driveCanceled = Menu.ShowMainMenu()
    if driveCanceled or not driveResult then
        return nil
    end

    gMyGamesDrive = driveResult
    saveSetting("MyGamesDrive", driveResult)
    return driveResult
end

local function extractFolderName(item)
    if not item then return nil end
    local path = nil
    if type(item) == "string" then
        path = item
    elseif type(item) == "table" or type(item) == "userdata" then
        local okN, n = pcall(function() return item.Name end)
        if okN and n and type(n) == "string" then return n end
        local okBN, bn = pcall(function() return item.BaseName end)
        if okBN and bn and type(bn) == "string" then return bn end
        local okFN, fn = pcall(function() return item.FileName end)
        if okFN and fn and type(fn) == "string" then return fn end
        local okP, p = pcall(function() return item.Path end)
        if okP and p and type(p) == "string" then path = p end
        if not path then
            local okS, s = pcall(tostring, item)
            if okS and s then path = s end
        end
    else
        local okS, s = pcall(tostring, item)
        if okS and s then path = s end
    end
    if not path or path == "" then return nil end
    local name = string.match(path, "([^/\\]+)[/\\]*$")
    return name
end

local function scanInstalledGames()
    Script.SetStatus(L("scanning_folders"))
    local games = {}
    local seen = {}

    local contentItems = nil
    local methods = {
        function() return Content.GetContentItems() end,
        function() return Content.GetItems() end,
        function() return Content.FindContent() end,
        function() return ContentItems.GetAll() end,
        function() return ContentItems.GetItems() end,
    }

    for _, method in ipairs(methods) do
        local ok, result = pcall(method)
        if ok and result and type(result) == "table" then
            contentItems = result
            break
        end
    end

    if not contentItems then
        return games
    end

    for _, item in ipairs(contentItems) do
        local titleId = nil
        local gameName = nil

        pcall(function()
            local rawId = item.TitleId
            if rawId then
                if type(rawId) == "number" then
                    titleId = string.format("%08X", rawId)
                elseif type(rawId) == "string" then
                    titleId = rawId:upper()
                end
            end
        end)

        if not titleId then
            pcall(function()
                local rawId = item.titleId or item.titleid or item.Title_Id
                if rawId then
                    if type(rawId) == "number" then
                        titleId = string.format("%08X", rawId)
                    elseif type(rawId) == "string" then
                        titleId = rawId:upper()
                    end
                end
            end)
        end

        pcall(function()
            gameName = item.Name or item.name or item.Title or item.title
        end)

        if titleId and titleId ~= "" and titleId ~= "00000000" and not seen[titleId] then
            seen[titleId] = true
            table.insert(games, {
                titleId = titleId,
                localName = gameName or titleId
            })
        end
    end

    return games
end

local function lookupTitleIds(titleIds)
    Script.SetStatus(L("looking_up_titles"))

    local batchSize = 30
    local allResults = {}

    for batchStart = 1, safeLen(titleIds), batchSize do
        local batchEnd = math.min(batchStart + batchSize - 1, safeLen(titleIds))
        local batch = {}
        for i = batchStart, batchEnd do
            table.insert(batch, titleIds[i])
        end

        local idsParam = table.concat(batch, ",")
        local url = API_BASE .. "/lookup?title_ids=" .. safeUrlEncode(idsParam)
        local data, err = httpGet(url)

        if data then
            for _, tid in ipairs(batch) do
                local titleField = jsonField(data, tid)
                if titleField then
                    allResults[tid] = { registered = true }
                end

                local pattern = '"' .. tid .. '"%s*:%s*%{'
                local matchStart = data:find(pattern)
                if matchStart then
                    local depth = 0
                    local objStart = data:find('%{', matchStart + tid:len())
                    if objStart then
                        for i = objStart, string.len(data) do
                            local c = data:sub(i, i)
                            if c == '{' then depth = depth + 1
                            elseif c == '}' then
                                depth = depth - 1
                                if depth == 0 then
                                    local objStr = data:sub(objStart, i)
                                    local gameId = jsonFieldNumber(objStr, "id")
                                    local gameTitle = jsonField(objStr, "title")
                                    local gamePlatform = jsonField(objStr, "platform")

                                    local files = {}
                                    local fileObjects = parseJsonArray(objStr, "files")
                                    for _, fobj in ipairs(fileObjects) do
                                        local wrapped = "{" .. fobj .. "}"
                                        local fTitleId = jsonField(wrapped, "title_id") or tid
                                        table.insert(files, {
                                            id = jsonFieldNumber(wrapped, "id"),
                                            label = jsonField(wrapped, "label") or "File",
                                            file_type = jsonField(wrapped, "file_type") or "game",
                                            server_path = jsonField(wrapped, "server_path") or "",
                                            folder_path = jsonField(wrapped, "folder_path") or "",
                                            title_id = fTitleId,
                                            file_size = jsonFieldNumber(wrapped, "file_size")
                                        })
                                    end

                                    allResults[tid] = {
                                        registered = true,
                                        id = gameId,
                                        title = gameTitle,
                                        platform = gamePlatform,
                                        files = files
                                    }
                                    break
                                end
                            end
                        end
                    end
                else
                    if not allResults[tid] then
                        allResults[tid] = { registered = false }
                    end
                end
            end
        end
    end

    return allResults
end

local function showMyGames()
    local ok, err = pcall(function()
        local installedGames = scanInstalledGames()
        local gameCount = safeLen(installedGames)

        if gameCount == 0 then
            Script.ShowMessageBox(L("my_games"), L("no_titles_found"), "OK")
            return
        end

        local titleIds = {}
        for _, g in ipairs(installedGames) do
            table.insert(titleIds, g.titleId)
        end

        local lookupResults = lookupTitleIds(titleIds)

        local entries = {}
        for _, g in ipairs(installedGames) do
            local tid = g.titleId
            local info = lookupResults[tid]
            if info and info.registered and info.id then
                table.insert(entries, {
                    titleId = tid,
                    localName = g.localName,
                    registered = true,
                    gameId = info.id,
                    platform = info.platform,
                    files = info.files or {}
                })
            else
                table.insert(entries, {
                    titleId = tid,
                    localName = g.localName,
                    registered = false
                })
            end
        end

        table.sort(entries, function(a, b)
            return a.localName < b.localName
        end)

        while true do
            Menu.ResetMenu()
            local titleStr = L("my_games") .. " (" .. string.format(L("my_games_count"), safeLen(entries)) .. ")"
            Menu.SetTitle(titleStr)
            Menu.SetExitOnCancel(false)
            Menu.SetGoBackText(L("back"))
            Menu.SetSortAlphaBetically(false)

            for idx, entry in ipairs(entries) do
                local label = entry.localName .. " [" .. entry.titleId .. "]"
                if entry.registered then
                    label = label .. " (+)"
                end
                local item = Menu.MakeMenuItem(label, idx)
                Menu.AddMainMenuItem(item)
            end

            local result, parentMenu, canceled = Menu.ShowMainMenu()
            if canceled or not result then return end

            if type(result) == "number" and result >= 1 and result <= safeLen(entries) then
                local entry = entries[result]
                if entry.registered and entry.gameId then
                    showGameDetails(entry.gameId)
                else
                    Script.ShowMessageBox(L("not_registered"),
                        string.format(L("not_registered_msg"), entry.titleId), "OK")
                end
            end
        end
    end)
    if not ok then
        Script.ShowMessageBox(L("error"), string.format(L("error_loading"), tostring(err)), "OK")
    end
end

local function doLogin()
    local ok1, keyboard1 = pcall(Script.ShowKeyboard, L("login_title"), L("login_prompt"), "", 0)
    if not ok1 or type(keyboard1) ~= "table" then
        Script.ShowMessageBox(L("error"), string.format(L("keyboard_error"), tostring(keyboard1)), "OK")
        return false
    end
    if keyboard1.Canceled then return false end
    local loginInput = keyboard1.Buffer
    if not loginInput or loginInput == "" then return false end

    local ok2, keyboard2 = pcall(Script.ShowKeyboard, L("login_title"), L("password_prompt"), "", 0)
    if not ok2 or type(keyboard2) ~= "table" then
        Script.ShowMessageBox(L("error"), string.format(L("keyboard_error"), tostring(keyboard2)), "OK")
        return false
    end
    if keyboard2.Canceled then return false end
    local passwordInput = keyboard2.Buffer
    if not passwordInput or passwordInput == "" then return false end

    local data, err
    while true do
        Script.SetStatus("Autenticando...")

        local authUrl = API_BASE .. "/auth/login?login=" .. safeUrlEncode(loginInput) .. "&password=" .. safeUrlEncode(passwordInput)
        data, err = httpGet(authUrl)

        Script.SetStatus("")

        if data then
            break
        end

        Menu.ResetMenu()
        Menu.SetTitle(L("connection_error_title"))
        Menu.SetExitOnCancel(true)
        Menu.SetGoBackText("")
        Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("retry_connection"), "retry"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("exit_option"), "exit"))

        Script.ShowMessageBox(L("login_failed"), string.format(L("login_error"), tostring(err)), "OK")

        local retryResult, _, retryCanceled = Menu.ShowMainMenu()
        if retryCanceled or not retryResult or retryResult == "exit" then
            return false
        end
    end

    local isSuccess = jsonFieldBool(data, "success")
    if not isSuccess then
        local serverErr = jsonField(data, "error")
        if serverErr and serverErr ~= "" then
            Script.ShowMessageBox(L("login_failed"), serverErr, "OK")
        else
            Script.ShowMessageBox(L("login_failed"), L("login_failed_msg"), "OK")
        end
        return false
    end

    gLoggedIn = true
    gUserId = jsonFieldNumber(data, "user_id") or 0
    gUserName = jsonField(data, "username") or loginInput
    gUserLevel = jsonFieldNumber(data, "level_id") or 0
    gUserLevelName = jsonField(data, "level_name") or "N/A"
    gDailyLimit = jsonFieldNumber(data, "daily_limit") or 0
    gDownloadsToday = jsonFieldNumber(data, "downloads_today") or 0
    gDownloadsRemaining = jsonFieldNumber(data, "downloads_remaining") or -1
    gDaysRemaining = jsonFieldNumber(data, "days_remaining")

    local isAllowed = jsonFieldBool(data, "allowed")
    gUserAllowed = (isAllowed == true)

    if not gUserAllowed then
        local levelDisplay = "Lv." .. tostring(gUserLevel) .. " - " .. gUserLevelName
        Script.ShowMessageBox(L("login_no_access"), string.format(L("login_no_access_msg"), levelDisplay), "OK")
        gLoggedIn = false
        return false
    end

    saveSetting("SavedLogin", loginInput)
    saveSetting("SavedPassword", passwordInput)
    saveSetting("SavedUserId", tostring(gUserId))

    Script.ShowNotification(L("login_success") .. " " .. gUserName)
    return true
end

local function refreshDownloadCount()
    if not gLoggedIn or gUserId == 0 then return end
    local checkUrl = API_BASE .. "/auth/check?user_id=" .. tostring(gUserId) .. "&level_id=" .. tostring(gUserLevel)
    local data, err = httpGet(checkUrl)
    if data then
        gDownloadsToday = jsonFieldNumber(data, "downloads_today") or gDownloadsToday
        gDownloadsRemaining = jsonFieldNumber(data, "downloads_remaining") or gDownloadsRemaining
        gDailyLimit = jsonFieldNumber(data, "daily_limit") or gDailyLimit
    end
end

local function canDownload()
    if gGuestMode then
        return gDownloadsRemaining > 0
    end
    if not gLoggedIn then return false end
    if not gUserAllowed then return false end
    if gDailyLimit > 0 and gDownloadsRemaining == 0 then
        return false
    end
    return true
end

local function showAccountInfo()
    local limitStr = tostring(gDailyLimit)
    if gDailyLimit == 0 then limitStr = "Ilimitado" end
    local remainStr = tostring(gDownloadsRemaining)
    if gDownloadsRemaining < 0 then remainStr = "Ilimitado" end
    local info = string.format(L("login_info"), gUserName, tostring(gUserLevel), gUserLevelName, gDownloadsToday, limitStr)
    info = info .. "\n" .. string.format(L("downloads_remaining"), remainStr)
    if gDaysRemaining then
        if gDaysRemaining > 0 then
            info = info .. "\n" .. string.format(L("account_expires"), gDaysRemaining)
        else
            info = info .. "\n" .. L("account_expired")
        end
    end
    Script.ShowMessageBox(L("login_menu"), info, "OK")
end

local function getConsoleInfo()
    local info = {}
    pcall(function() info.version = Kernel.GetVersion() end)
    pcall(function() info.console_type = Kernel.GetConsoleType() end)
    pcall(function() info.motherboard = Kernel.GetMotherboardType() end)
    pcall(function() info.serial = Kernel.GetSerialNumber() end)
    pcall(function() info.console_id = Kernel.GetConsoleId() end)
    pcall(function() info.dvd_key = Kernel.GetDVDKey() end)
    pcall(function() info.cpu_key = Kernel.GetCPUKey() end)
    return info
end

local function showConsoleInfo()
    local info = getConsoleInfo()
    local text = ""
    text = text .. "Kernel Version: " .. tostring(info.version or "N/A") .. "\n"
    text = text .. "Console Type: " .. tostring(info.console_type or "N/A") .. "\n"
    text = text .. "Motherboard: " .. tostring(info.motherboard or "N/A") .. "\n"
    text = text .. "Serial: " .. tostring(info.serial or "N/A") .. "\n"
    text = text .. "Console ID: " .. tostring(info.console_id or "N/A") .. "\n"
    text = text .. "DVD Key: " .. tostring(info.dvd_key or "N/A") .. "\n"
    text = text .. "CPU Key: " .. tostring(info.cpu_key or "N/A")
    Script.ShowMessageBox(L("console_info_title"), text, "OK")
end

local WEBUI_CONTENT_GROUP = {
    Start = 0, Hidden = 0, Xbox360 = 1, XBLA = 2, Indie = 3,
    XboxClassic = 4, Unsigned = 5, LibXenon = 6, Count = 7
}

local WEBUI_EXEC_TYPE = {
    None = -1, Xex = 0, Xbe = 1, XexCon = 2, XbeCon = 3, XnaCon = 4
}

local function trimStr(s)
    return (s:gsub("^%s*(.-)%s*$", "%1"))
end

local function webuiDeleteDirectoryContents(path)
    local success = true
    local glob = path .. "\\*"
    local files = FileSystem.GetFiles(glob)
    local dirs = FileSystem.GetDirectories(glob)
    for _, x in pairs(files) do
        success = success and FileSystem.DeleteFile(path .. "\\" .. x.Name)
    end
    for _, x in pairs(dirs) do
        success = success and FileSystem.DeleteDirectory(path .. "\\" .. x.Name)
    end
    return success
end

local function webuiGetExecutableRoot(contentRoot)
    local devices = {}
    devices["flash:"] = "\\SystemRoot"
    devices["dvd:"] = "\\Device\\Cdrom0"
    devices["hdd1:"] = "\\Device\\Harddisk0\\Partition1"
    devices["hdd0:"] = "\\Device\\Harddisk0\\Partition0"
    devices["hddx:"] = "\\Device\\Harddisk0\\SystemPartition"
    devices["sysext:"] = "\\sep"
    devices["memunit0:"] = "\\Device\\Mu0"
    devices["memunit1:"] = "\\Device\\Mu1"
    devices["usb0:"] = "\\Device\\Mass0"
    devices["usb1:"] = "\\Device\\Mass1"
    devices["usb2:"] = "\\Device\\Mass2"
    devices["hddvdplayer:"] = "\\Device\\HdDvdPlayer"
    devices["hddvdstorage:"] = "\\Device\\HdDvdStorage"
    devices["transfercable:"] = "\\Device\\Transfercable"
    devices["transfercablexbox1:"] = "\\Device\\Transfercable\\Compatibility\\Xbox1"
    devices["usbmu0:"] = "\\Device\\Mass0PartitionFile\\Storage"
    devices["usbmu1:"] = "\\Device\\Mass1PartitionFile\\Storage"
    devices["usbmu2:"] = "\\Device\\Mass2PartitionFile\\Storage"
    devices["usbmucache0:"] = "\\Device\\Mass0PartitionFile\\StorageSystem"
    devices["usbmucache1:"] = "\\Device\\Mass1PartitionFile\\StorageSystem"
    devices["usbmucache2:"] = "\\Device\\Mass2PartitionFile\\StorageSystem"
    return devices[contentRoot:lower()] or ""
end

local function webuiGetExecutableType(executable, contentGroup)
    local isContainer = executable:reverse():find("%.") == nil
    if contentGroup == WEBUI_CONTENT_GROUP.Start
        or contentGroup == WEBUI_CONTENT_GROUP.Xbox360
        or contentGroup == WEBUI_CONTENT_GROUP.XBLA
        or contentGroup == WEBUI_CONTENT_GROUP.Unsigned
        or contentGroup == WEBUI_CONTENT_GROUP.LibXenon
        or contentGroup == WEBUI_CONTENT_GROUP.Count
    then
        if isContainer then return WEBUI_EXEC_TYPE.XexCon
        else return WEBUI_EXEC_TYPE.Xex end
    elseif contentGroup == WEBUI_CONTENT_GROUP.Indie then
        if isContainer then return WEBUI_EXEC_TYPE.XnaCon end
    elseif contentGroup == WEBUI_CONTENT_GROUP.XboxClassic then
        if isContainer then return WEBUI_EXEC_TYPE.XbeCon
        else return WEBUI_EXEC_TYPE.Xbe end
    end
    return WEBUI_EXEC_TYPE.None
end

local function webuiGetFileUrls(contentId, titleId)
    local i = 1
    local fileUrls = {}
    local assetInfoPath = "Game:\\Data\\GameData\\"
        .. string.format("%08X", titleId):sub(-8)
        .. "_"
        .. string.format("%08X", contentId):sub(-8)
        .. "\\GameAssetInfo.bin"
    if FileSystem.FileExists(assetInfoPath) then
        local assetXml = FileSystem.ReadFile(assetInfoPath)
        for x in string.gmatch(assetXml, "<live:fileUrl>([^<]+)</live:fileUrl>") do
            fileUrls[i] = x
            i = i + 1
        end
    end
    return fileUrls
end

local function webuiIsTile(url)
    return url:sub(-#"tile.png") == "tile.png" or url:sub(-#"icon/0/8000") == "icon/0/8000"
end
local function webuiIsBoxartLarge(url)
    return url:sub(-#"boxartlg.jpg") == "boxartlg.jpg" or url:sub(-#"xboxboxart.jpg") == "xboxboxart.jpg"
end
local function webuiIsBoxartSmall(url)
    return url:sub(-#"boxartsm.jpg") == "boxartsm.jpg" or url:sub(-#"webboxart.jpg") == "webboxart.jpg"
end
local function webuiIsBackground(url)
    return url:sub(-#"background.jpg") == "background.jpg"
end
local function webuiIsBanner(url)
    return url:sub(-#"banner.png") == "banner.png" or url:sub(-#"marketplace/0/1") == "marketplace/0/1"
end
local function webuiIsScreenshot(url)
    return string.match(url, "screen%d+.jpg$") ~= nil or string.match(url, "screenlg%d+.jpg$") ~= nil
end

local function webuiUpdateTitlesJSON()
    local contentCount = 0
    local contentCountSql = "SELECT seq FROM sqlite_sequence WHERE name = 'ContentItems'"
    local contentIdSql = "SELECT Id FROM ContentItems"
    local titles = {}
    Script.SetStatus(L("nova_update_progress"))
    Script.SetProgress(0)
    for _, row in pairs(Sql.ExecuteFetchRows(contentCountSql)) do
        contentCount = row.seq
    end
    for i, row in pairs(Sql.ExecuteFetchRows(contentIdSql)) do
        local contentInfo = Content.GetInfo(row.Id)
        local entry = {}
        entry["titleid"] = string.format("0x%08X", contentInfo.TitleId)
        entry["directory"] = webuiGetExecutableRoot(contentInfo.Root) .. contentInfo.Directory
        entry["executable"] = contentInfo.Executable
        entry["type"] = webuiGetExecutableType(contentInfo.Executable, contentInfo.DefaultGroup)
        entry["titleName"] = contentInfo.Name
        entry["contentGroup"] = contentInfo.Group
        entry["hidden"] = contentInfo.Hidden
        entry["art"] = {}
        entry["art"]["tile"] = ""
        entry["art"]["boxartLarge"] = ""
        entry["art"]["boxartSmall"] = ""
        entry["art"]["background"] = ""
        entry["art"]["banner"] = ""
        entry["art"]["screenshots"] = {}
        local fileUrls = webuiGetFileUrls(row.Id, contentInfo.TitleId)
        for _, fileUrl in pairs(fileUrls) do
            if webuiIsTile(fileUrl) then entry["art"]["tile"] = fileUrl end
            if webuiIsBoxartLarge(fileUrl) then entry["art"]["boxartLarge"] = fileUrl end
            if webuiIsBoxartSmall(fileUrl) then entry["art"]["boxartSmall"] = fileUrl end
            if webuiIsBackground(fileUrl) then entry["art"]["background"] = fileUrl end
            if webuiIsBanner(fileUrl) then entry["art"]["banner"] = fileUrl end
            if webuiIsScreenshot(fileUrl) then
                table.insert(entry["art"]["screenshots"], fileUrl)
            end
        end
        table.insert(titles, entry)
        if contentCount > 0 then
            Script.SetProgress(math.floor(i / contentCount * 100))
        end
    end
    Script.SetProgress(100)
    local titlesOk = FileSystem.WriteFile(
        "Game:\\Plugins\\WebRoot\\api\\titles.json",
        json:encode(titles)
    )
    pcall(function()
        local configData = { cmsUrl = SERVER_URL }
        FileSystem.WriteFile(
            "Game:\\Plugins\\WebRoot\\api\\config.json",
            json:encode(configData)
        )
    end)
    return titlesOk
end

local function webuiBackup()
    local srcPath = "Game:\\Plugins\\WebRoot"
    local destPath = nil
    repeat
        local keyboardData = Script.ShowKeyboard(
            L("nova_backup_name"),
            L("nova_backup_prompt"),
            "",
            0
        )
        if keyboardData.Canceled then
            return false
        end
        local tempPath = Script.GetBasePath() .. "webuis\\" .. trimStr(keyboardData.Buffer)
        if FileSystem.FileExists(tempPath) then
            Script.ShowMessageBox(L("error"), L("nova_backup_exists"), "OK")
        else
            destPath = tempPath
        end
    until destPath ~= nil
    if not FileSystem.CopyDirectory(srcPath, destPath, true) then
        Script.ShowMessageBox(L("error"), L("nova_backup_fail"), "OK")
        return false
    end
    return true
end

local function webuiSelectWebUI()
    local webUisPath = Script.GetBasePath() .. "webuis"
    local webUis = {}
    for _, d in pairs(FileSystem.GetDirectories(webUisPath .. "\\*")) do
        table.insert(webUis, d.Name)
    end
    table.sort(webUis)
    local ret = Script.ShowPopupList(
        L("nova_select_webui"),
        L("nova_no_webuis"),
        webUis
    )
    if ret.Canceled then return "" end
    return webUisPath .. "\\" .. ret.Selected.Value
end

local function webuiInstall(srcPath)
    local destPath = "Game:\\Plugins\\WebRoot"
    if not webuiDeleteDirectoryContents(destPath) then
        Script.ShowMessageBox(L("error"), L("nova_install_fail_delete"), "OK")
        return false
    end
    if not FileSystem.CopyDirectory(srcPath, destPath, true) then
        Script.ShowMessageBox(L("error"), L("nova_install_fail_copy"), "OK")
        return false
    end
    pcall(FileSystem.CreateDirectory, "Game:\\Plugins\\WebRoot\\api")
    if not webuiUpdateTitlesJSON() then
        Script.ShowNotification(L("nova_update_fail"), 2)
    else
        Script.ShowNotification(L("nova_update_ok"), 0)
    end
    return true
end

local function showNovaWebUI()
    while true do
        Menu.ResetMenu()
        Menu.SetTitle(L("nova_webui"))
        Menu.SetExitOnCancel(false)
        Menu.SetGoBackText(L("back"))

        Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("nova_install"), "install"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("nova_backup"), "backup"))
        Menu.AddMainMenuItem(Menu.MakeMenuItem("3. " .. L("nova_update_titles"), "update"))

        local result, _, canceled = Menu.ShowMainMenu()
        if canceled or not result then return end

        local actionOk, actionErr = pcall(function()
            if result == "install" then
                local selectedWebUi = webuiSelectWebUI()
                if selectedWebUi == "" then return end
                if not webuiInstall(selectedWebUi) then
                    Script.ShowNotification(L("nova_install_fail_copy"), 2)
                    return
                end
                Script.ShowNotification(L("nova_install_ok"), 0)
                local ip = Aurora.GetIPAddress() or "XBOX_IP"
                Script.ShowMessageBox(
                    L("complete"),
                    string.format(L("nova_install_access"), ip),
                    "OK"
                )
            elseif result == "backup" then
                if not webuiBackup() then
                    return
                end
                Script.ShowNotification(L("nova_backup_ok"), 0)
            elseif result == "update" then
                if not webuiUpdateTitlesJSON() then
                    Script.ShowNotification(L("nova_update_fail"), 2)
                    return
                end
                Script.ShowNotification(L("nova_update_ok"), 0)
            end
        end)
        if not actionOk then
            Script.ShowMessageBox(L("error"),
                string.format(L("error_occurred"), tostring(actionErr)), "OK")
        end
    end
end

local function initConsoleId()
    pcall(function()
        gConsoleId = Kernel.GetConsoleId() or ""
    end)
end

local function showGameList(searchTerm, platform, category, categoryLabel)
    local ok, err = pcall(function()
        local games = fetchGames(searchTerm, platform, category)
        local gameCount = safeLen(games)

        if gameCount == 0 then
            if searchTerm then
                Script.ShowMessageBox(L("no_results"),
                    string.format(L("no_results_msg"), searchTerm), "OK")
            else
                Script.ShowMessageBox(L("empty"), L("empty_msg"), "OK")
            end
            return
        end

        local titleStr = "GodStix"
        if searchTerm then titleStr = L("search") .. ": " .. searchTerm end
        if platform then titleStr = titleStr .. " [" .. getPlatformLabel(platform) .. "]" end
        if categoryLabel then titleStr = titleStr .. " [" .. categoryLabel .. "]" end
        titleStr = titleStr .. " (" .. string.format(L("games_count"), gameCount) .. ")"

        if gameCount > 20 and not searchTerm then
            showGameListAlpha(games, gameCount, titleStr)
        else
            showGameListDirect(games, gameCount, titleStr)
        end
    end)
    if not ok then
        Script.ShowMessageBox(L("error"), string.format(L("error_loading"), tostring(err)), "OK")
    end
end

local function tryAutoLogin()
    local ok, ini = pcall(IniFile.LoadFile, "GODSend.ini")
    if not ok or not ini then return false end
    local savedLogin = ini:ReadValue("Settings", "SavedLogin", "")
    local savedPassword = ini:ReadValue("Settings", "SavedPassword", "")
    if savedLogin == "" or savedPassword == "" then return false end

    Script.SetStatus(L("auto_login_msg"))
    local authUrl = API_BASE .. "/auth/login?login=" .. safeUrlEncode(savedLogin) .. "&password=" .. safeUrlEncode(savedPassword)
    local data, err = httpGet(authUrl)
    Script.SetStatus("")

    if not data then
        saveSetting("SavedLogin", "")
        saveSetting("SavedPassword", "")
        saveSetting("SavedUserId", "")
        return false
    end

    local isSuccess = jsonFieldBool(data, "success")
    if not isSuccess then
        saveSetting("SavedLogin", "")
        saveSetting("SavedPassword", "")
        saveSetting("SavedUserId", "")
        return false
    end

    gLoggedIn = true
    gUserId = jsonFieldNumber(data, "user_id") or 0
    gUserName = jsonField(data, "username") or savedLogin
    gUserLevel = jsonFieldNumber(data, "level_id") or 0
    gUserLevelName = jsonField(data, "level_name") or "N/A"
    gDailyLimit = jsonFieldNumber(data, "daily_limit") or 0
    gDownloadsToday = jsonFieldNumber(data, "downloads_today") or 0
    gDownloadsRemaining = jsonFieldNumber(data, "downloads_remaining") or -1
    gDaysRemaining = jsonFieldNumber(data, "days_remaining")

    local isAllowed = jsonFieldBool(data, "allowed")
    if isAllowed ~= true then
        saveSetting("SavedLogin", "")
        saveSetting("SavedPassword", "")
        saveSetting("SavedUserId", "")
        gLoggedIn = false
        return false
    end

    gGuestMode = false
    Script.ShowNotification(L("login_success") .. " " .. gUserName)
    return true
end

local function doLogout()
    gLoggedIn = false
    gGuestMode = false
    gUserId = 0
    gUserName = ""
    gUserLevel = 0
    gUserLevelName = ""
    gDailyLimit = 0
    gDownloadsToday = 0
    gDownloadsRemaining = -1
    saveSetting("SavedLogin", "")
    saveSetting("SavedPassword", "")
    saveSetting("SavedUserId", "")
end

local function showWelcomeScreen()
    if tryAutoLogin() then
        return true
    end

    Menu.ResetMenu()
    Menu.SetTitle(L("splash_title"))
    Menu.SetExitOnCancel(true)
    Menu.SetGoBackText("")

    Menu.AddMainMenuItem(Menu.MakeMenuItem("1. " .. L("guest_access"), "guest"))
    Menu.AddMainMenuItem(Menu.MakeMenuItem("2. " .. L("guest_login"), "login"))
    Menu.AddMainMenuItem(Menu.MakeMenuItem("3. " .. L("register_access"), "register"))

    local splashMsg = string.format(L("splash_msg"), scriptVersion)
    Script.ShowMessageBox(L("splash_title"), splashMsg, "OK")

    local result, _, canceled = Menu.ShowMainMenu()

    if canceled or not result then
        return false
    end

    if result == "register" then
        Script.ShowMessageBox(L("register_access"), L("register_msg"), "OK")
        return showWelcomeScreen()
    elseif result == "guest" then
        gLoggedIn = false
        gGuestMode = true
        gDailyLimit = 2
        gDownloadsToday = 0
        gDownloadsRemaining = 2
        gUserName = L("guest_name")
        gUserLevel = 0
        gUserLevelName = L("guest_name")
        if gConsoleId ~= "" then
            local url = API_BASE .. "/guest/check?console_id=" .. safeUrlEncode(gConsoleId)
            local data, err = httpGet(url)
            if data then
                local canDl = jsonFieldBool(data, "can_download")
                gDownloadsToday = jsonFieldNumber(data, "downloads_today") or 0
                gDownloadsRemaining = jsonFieldNumber(data, "downloads_remaining") or 1
                if canDl == false then
                    gDownloadsRemaining = 0
                end
            end
        end
        return true
    elseif result == "login" then
        if doLogin() then
            gGuestMode = false
            return true
        end
        return showWelcomeScreen()
    end

    return false
end

function main()
    loadSettings()
    initConsoleId()

    gTempDownloadCounter = 0

    pcall(function()
        if isFirstRun() then
            Script.ShowMessageBox(L("welcome_title"), L("welcome_msg"), "OK")
            showLanguageSelection(true)
            loadSettings()
        end
    end)

    if not Aurora.HasInternetConnection() then
        Script.ShowMessageBox(L("no_network"), L("no_network_msg"), "OK")
        return
    end

    if not testConnection() then return end

    if gConsoleId ~= "" then
        local registerOk = true
        pcall(function()
            local data, err = httpGet(API_BASE .. "/console/register?console_id=" .. safeUrlEncode(gConsoleId))
            if data then
                local isBanned = jsonFieldBool(data, "banned")
                if isBanned then
                    registerOk = false
                end
            end
        end)
        if not registerOk then
            Script.ShowMessageBox(L("console_banned"),
                string.format(L("console_banned_msg"), gConsoleId), "OK")
            return
        end
    end

    if not showWelcomeScreen() then
        return
    end

    while true do
        if gLoggedIn and not gGuestMode then
            refreshDownloadCount()
        end

        Menu.ResetMenu()

        local titleStr = "GodStix v" .. scriptVersion
        if gLoggedIn then
            local remainStr = ""
            if gDailyLimit > 0 then
                remainStr = " | " .. tostring(gDownloadsRemaining) .. "/" .. tostring(gDailyLimit)
            end
            titleStr = titleStr .. " [" .. gUserName .. " Lv." .. tostring(gUserLevel) .. remainStr .. "]"
        elseif gGuestMode then
            titleStr = titleStr .. " [" .. L("guest_name") .. " | " .. tostring(gDownloadsRemaining) .. "/2]"
        end

        Menu.SetTitle(titleStr)
        Menu.SetExitOnCancel(true)
        Menu.SetGoBackText("")

        local menuNum = 1
        local function menuLabel(text, action)
            local num = string.format("%02d", menuNum)
            menuNum = menuNum + 1
            Menu.AddMainMenuItem(Menu.MakeMenuItem(num .. ". " .. text, action))
        end
        menuLabel(L("browse_all"), "browse_all")
        menuLabel(L("browse_platform"), "platform")
        menuLabel(L("browse_category"), "category")
        menuLabel(L("search"), "search")
        menuLabel(L("my_games"), "my_games")
        if gLoggedIn and not gGuestMode and gUserId > 0 then
            menuLabel(L("my_list"), "my_list")
        end
        local queueCount = getDownloadQueueCount()
        local dlListLabel = L("download_list")
        if queueCount > 0 then
            dlListLabel = dlListLabel .. " (" .. string.format(L("download_list_count"), queueCount) .. ")"
        end
        menuLabel(dlListLabel, "download_list")
        menuLabel(L("console_info"), "console_info")
        menuLabel(L("settings"), "settings")
        if gLoggedIn and not gGuestMode then
            menuLabel(L("login_menu"), "account")
            menuLabel("Logout", "logout")
            menuLabel(L("about"), "about")
        elseif gGuestMode then
            menuLabel(L("guest_login"), "do_login")
            menuLabel(L("about"), "about")
        else
            menuLabel(L("about"), "about")
        end
        local result, parentMenu, canceled = Menu.ShowMainMenu()

        if canceled or not result then
            return
        end

        local actionOk, actionErr = pcall(function()
            if result == "browse_all" then
                showGameList(nil, nil)

            elseif result == "search" then
                local term = showSearchMenu()
                if term then
                    showGameList(term, nil)
                end

            elseif result == "my_games" then
                showMyGames()

            elseif result == "download_list" then
                showDownloadList()

            elseif result == "my_list" then
                local favUrl = API_BASE .. "/favorites?user_id=" .. tostring(gUserId)
                local favData = httpGet(favUrl)
                if not favData then
                    Script.ShowMessageBox(L("error"), L("connection_error"), "OK")
                else
                    local favGames = {}
                    pcall(function()
                        local gameObjects = parseJsonArray(favData, "games")
                        for _, obj in ipairs(gameObjects) do
                            local wrapped = "{" .. obj .. "}"
                            local gid = jsonFieldNumber(wrapped, "id")
                            local gtitle = jsonField(wrapped, "title")
                            if gid and gtitle then
                                table.insert(favGames, { id = gid, title = gtitle })
                            end
                        end
                    end)
                    if safeLen(favGames) == 0 then
                        Script.ShowMessageBox(L("my_list"), L("no_favorites"), "OK")
                    else
                        Menu.ResetMenu()
                        Menu.SetTitle(L("my_list") .. " (" .. tostring(safeLen(favGames)) .. ")")
                        Menu.SetExitOnCancel(false)
                        Menu.SetGoBackText(L("back"))
                        for idx, fg in ipairs(favGames) do
                            Menu.AddMainMenuItem(Menu.MakeMenuItem(tostring(idx) .. ". " .. fg.title, tostring(fg.id)))
                        end
                        local favResult, _, favCanceled = Menu.ShowMainMenu()
                        if not favCanceled and favResult then
                            local selectedId = tonumber(favResult)
                            if selectedId then
                                showGameDetails(selectedId)
                            end
                        end
                    end
                end

            elseif result == "platform" then
                Menu.ResetMenu()
                Menu.SetTitle(L("select_platform"))
                Menu.SetExitOnCancel(false)
                Menu.SetGoBackText(L("back"))

                Menu.AddMainMenuItem(Menu.MakeMenuItem("Xbox 360", "xbox360"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem("Xbox Original", "xbox_original"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem("Digital / XBLA", "digital"))

                local platResult, _, platCanceled = Menu.ShowMainMenu()
                if not platCanceled and platResult then
                    showGameList(nil, platResult)
                end

            elseif result == "category" then
                local cats = fetchCategories()
                if safeLen(cats) == 0 then
                    Script.ShowMessageBox(L("error"), L("no_categories"), "OK")
                else
                    Menu.ResetMenu()
                    Menu.SetTitle(L("select_category"))
                    Menu.SetExitOnCancel(false)
                    Menu.SetGoBackText(L("back"))

                    for idx, cat in ipairs(cats) do
                        Menu.AddMainMenuItem(Menu.MakeMenuItem(tostring(idx) .. ". " .. cat.label, cat.value))
                    end

                    local catResult, _, catCanceled = Menu.ShowMainMenu()
                    if not catCanceled and catResult then
                        local catLabel = catResult
                        for _, cat in ipairs(cats) do
                            if cat.value == catResult then
                                catLabel = cat.label
                                break
                            end
                        end
                        showGameList(nil, nil, catResult, catLabel)
                    end
                end

            elseif result == "settings" then
                Menu.ResetMenu()
                Menu.SetTitle(L("settings"))
                Menu.SetExitOnCancel(false)
                Menu.SetGoBackText(L("back"))

                Menu.AddMainMenuItem(Menu.MakeMenuItem(L("install_drive") .. ": " .. gInstallDrive, "drive"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem(L("test_connection"), "test"))
                local retryLabel = tostring(gMaxAttempts)
                if gMaxAttempts <= 0 then retryLabel = L("retry_disabled") end
                Menu.AddMainMenuItem(Menu.MakeMenuItem(string.format(L("retry_count"), retryLabel), "retries"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem(L("language") .. ": " .. getLangName(gCurrentLang), "language"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem(L("dns_guide"), "dns_guide"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem(L("nova_webui"), "nova_webui"))
                Menu.AddMainMenuItem(Menu.MakeMenuItem(L("credits"), "credits"))

                local setResult, _, setCanceled = Menu.ShowMainMenu()

                if not setCanceled and setResult then
                    if setResult == "drive" then
                        Menu.ResetMenu()
                        Menu.SetTitle(L("select_drive"))
                        Menu.SetExitOnCancel(false)
                        Menu.SetGoBackText(L("back"))

                        local drives = getAvailableDrives()
                        if #drives == 0 then
                            Script.ShowMessageBox(L("error"), L("no_drives"), "OK")
                        else
                        for _, d in ipairs(drives) do
                            local label = d
                            if d == gInstallDrive then label = d .. " *" end
                            Menu.AddMainMenuItem(Menu.MakeMenuItem(label, d))
                        end

                        local driveResult, _, driveCanceled = Menu.ShowMainMenu()
                        if not driveCanceled and driveResult then
                            gInstallDrive = driveResult
                            Script.ShowNotification(L("install_drive") .. ": " .. gInstallDrive)
                        end
                        end

                    elseif setResult == "retries" then
                        Menu.ResetMenu()
                        local currentLabel = tostring(gMaxAttempts)
                        if gMaxAttempts <= 0 then currentLabel = L("retry_disabled") end
                        Menu.SetTitle(string.format(L("retry_select"), currentLabel))
                        Menu.SetExitOnCancel(false)
                        Menu.SetGoBackText(L("back"))

                        Menu.AddMainMenuItem(Menu.MakeMenuItem(L("retry_off"), "0"))
                        for i = 1, 10 do
                            local label = tostring(i)
                            if i == gMaxAttempts then label = label .. " *" end
                            Menu.AddMainMenuItem(Menu.MakeMenuItem(label, tostring(i)))
                        end

                        local retryResult, _, retryCanceled = Menu.ShowMainMenu()
                        if not retryCanceled and retryResult then
                            local n = tonumber(retryResult)
                            if n then
                                gMaxAttempts = n
                                saveSetting("MaxRetries", tostring(n))
                                if n == 0 then
                                    Script.ShowNotification(L("retry_settings") .. ": " .. L("retry_disabled"))
                                else
                                    Script.ShowNotification(L("retry_settings") .. ": " .. tostring(n))
                                end
                            end
                        end

                    elseif setResult == "test" then
                        if testConnection() then
                            Script.ShowNotification(L("connection_ok"))
                        end

                    elseif setResult == "language" then
                        showLanguageSelection()

                    elseif setResult == "dns_guide" then
                        Script.ShowMessageBox(L("dns_title"), L("dns_msg"), "OK")

                    elseif setResult == "nova_webui" then
                        showNovaWebUI()

                    elseif setResult == "credits" then
                        Script.ShowMessageBox(L("credits_title"), L("credits_msg"), "OK")
                    end
                end

            elseif result == "console_info" then
                showConsoleInfo()

            elseif result == "do_login" then
                if doLogin() then
                    gGuestMode = false
                end

            elseif result == "account" then
                showAccountInfo()

            elseif result == "logout" then
                doLogout()
                Script.ShowNotification("Logged out")
                if not showWelcomeScreen() then
                    return
                end

            elseif result == "about" then
                Script.ShowMessageBox("GodStix v" .. scriptVersion,
                    string.format(L("about_msg"), gInstallDrive), "OK")

            end
        end)

        if not actionOk then
            Script.ShowMessageBox(L("error"),
                string.format(L("error_occurred"), tostring(actionErr)), "OK")
        end
    end
end
