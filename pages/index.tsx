import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
    return {
        redirect: {
            destination: '/map',
            permanent: false,
        },
    };
};

export default function IndexRedirect() {
    return null;
}

