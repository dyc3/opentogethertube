use rand::Rng;

pub(crate) fn random_unused_port() -> u16 {
    loop {
        let port = rand::thread_rng().gen_range(1024..65535);

        if port_is_available(port) {
            return port;
        }
    }
}

pub(crate) fn port_is_available(port: u16) -> bool {
    std::net::TcpListener::bind(("localhost", port)).is_ok()
}
